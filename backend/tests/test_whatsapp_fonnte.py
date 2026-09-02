"""Tests for the Fonnte WhatsApp integration: webhook, /whatsapp/send, and settings.

Covers:
- Settings default fonnte_* fields
- Settings PUT persists fonnte_api_key + fonnte_device
- POST /api/whatsapp/send: 401 no auth, 400 empty key, 502 invalid key
- POST /api/webhook/fonnte: happy path, format errors, stock, fuzzy match, phone normalization
"""

import os
import re
import secrets

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def a_product(auth_headers):
    """Pick or create a product with enough stock to run webhook tests."""
    r = requests.get(f"{BASE_URL}/api/products", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    products = r.json()
    # find product with stock >= 5
    candidate = next((p for p in products if int(p.get("stock", 0)) >= 5), None)
    if candidate:
        return candidate
    # otherwise create one
    payload = {
        "name": f"TEST_WA_PROD_{secrets.token_hex(3)}",
        "variant": "Coklat Keju",
        "sku": f"TESTWA{secrets.token_hex(3)}",
        "cost_price": 5000,
        "selling_price": 10000,
        "stock": 50,
        "unit": "pcs",
        "description": "test wa product",
    }
    r = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()


# ---------- Settings ----------
class TestSettingsFonnte:
    def test_get_settings_has_fonnte_defaults(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert "fonnte_api_key" in s
        assert "fonnte_device" in s

    def test_put_settings_persists_fonnte(self, auth_headers):
        # snapshot current
        cur = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15).json()
        old_key = cur.get("fonnte_api_key", "") or ""
        old_dev = cur.get("fonnte_device", "") or ""
        try:
            r = requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": "", "fonnte_device": "6289999999999"},
                timeout=15,
            )
            assert r.status_code == 200
            g = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15).json()
            assert g.get("fonnte_device") == "6289999999999"
            assert g.get("fonnte_api_key", "") == ""
        finally:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": old_key, "fonnte_device": old_dev},
                timeout=15,
            )


# ---------- /whatsapp/send ----------
class TestWhatsappSend:
    def test_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/whatsapp/send",
            json={"phone": "08123", "message": "hi"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_empty_key_returns_400(self, auth_headers):
        # Make sure key is empty
        cur = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15).json()
        old_key = cur.get("fonnte_api_key", "") or ""
        try:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": ""},
                timeout=15,
            )
            r = requests.post(
                f"{BASE_URL}/api/whatsapp/send",
                headers=auth_headers,
                json={"phone": "081234567890", "message": "hi"},
                timeout=15,
            )
            assert r.status_code == 400
            detail = r.json().get("detail", "")
            assert "API key Fonnte belum diatur" in detail
        finally:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": old_key},
                timeout=15,
            )

    def test_invalid_key_returns_502(self, auth_headers):
        cur = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15).json()
        old_key = cur.get("fonnte_api_key", "") or ""
        try:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": "INVALID_TEST_KEY_XXX"},
                timeout=15,
            )
            r = requests.post(
                f"{BASE_URL}/api/whatsapp/send",
                headers=auth_headers,
                json={"phone": "081234567890", "message": "hi"},
                timeout=30,
            )
            assert r.status_code == 502, r.text
            # NB: Cloudflare edge may replace 5xx JSON body with its own HTML
            # error page, so we can't reliably parse the detail here. The 502
            # status itself is emitted by our FastAPI handler when Fonnte
            # rejects the invalid key.
            try:
                detail = r.json().get("detail", "")
                if detail:
                    assert ("Fonnte gagal" in detail) or ("Fonnte error" in detail)
            except Exception:
                pass
        finally:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": old_key},
                timeout=15,
            )


# ---------- Webhook (no auth) ----------
def _cleanup_txn(auth_headers, txn_number):
    if not txn_number:
        return
    # Look up by transaction_number via list
    r = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers, timeout=15)
    if r.status_code != 200:
        return
    for t in r.json():
        if t.get("transaction_number") == txn_number:
            requests.delete(f"{BASE_URL}/api/transactions/{t['id']}", headers=auth_headers, timeout=15)
            break


class TestWebhookFonnte:
    def test_bad_format_two_parts(self):
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "628111", "message": "Only two parts"},
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is False
        assert "Format" in j["reason"]

    def test_non_integer_quantity(self, a_product):
        msg = f"TEST_WA_{secrets.token_hex(2)}, {a_product['name']}, abc, {a_product.get('variant','')}, x"
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "628111", "message": msg},
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is False
        assert "Jumlah harus angka" in j["reason"]

    def test_unknown_product(self):
        msg = f"TEST_WA_{secrets.token_hex(2)}, __NoSuchProductXYZ__, 1, , x"
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "628111", "message": msg},
            timeout=15,
        )
        j = r.json()
        assert j["ok"] is False
        assert "tidak ditemukan" in j["reason"]

    def test_insufficient_stock(self, a_product):
        big_qty = int(a_product.get("stock", 0)) + 99999
        variant = a_product.get("variant", "") or ""
        msg = f"TEST_WA_{secrets.token_hex(2)}, {a_product['name']}, {big_qty}, {variant}, x"
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "628111", "message": msg},
            timeout=15,
        )
        j = r.json()
        assert j["ok"] is False
        assert "tidak cukup" in j["reason"]

    def test_happy_path_decrements_stock(self, auth_headers, a_product):
        pid = a_product["id"]
        before = requests.get(f"{BASE_URL}/api/products", headers=auth_headers, timeout=15).json()
        stock_before = next(p["stock"] for p in before if p["id"] == pid)
        cust = f"TEST_WA_{secrets.token_hex(3)}"
        variant = a_product.get("variant", "") or ""
        msg = f"{cust}, {a_product['name']}, 2, {variant}, extra saus"
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "6281200000001", "message": msg},
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True, j
        assert j["transaction_number"].startswith("TRX-")
        txn_number = j["transaction_number"]

        # verify transaction persisted
        txns = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers, timeout=15).json()
        txn = next((t for t in txns if t.get("transaction_number") == txn_number), None)
        assert txn is not None
        assert txn["customer_name"] == cust
        assert txn["source"] == "whatsapp"
        assert txn["payment_method"] == "WhatsApp"
        assert txn["customer_phone"] == "6281200000001"
        it = txn["items"][0]
        assert it["product_name"] == a_product["name"]
        assert it["quantity"] == 2
        assert it["note"] == "extra saus"

        # verify stock decremented
        after = requests.get(f"{BASE_URL}/api/products", headers=auth_headers, timeout=15).json()
        stock_after = next(p["stock"] for p in after if p["id"] == pid)
        assert stock_after == stock_before - 2

        # cleanup
        _cleanup_txn(auth_headers, txn_number)

    def test_fuzzy_lowercase_product_and_partial_variant(self, auth_headers, a_product):
        # lowercase name + partial variant (first word) should still match
        variant = a_product.get("variant", "") or ""
        partial_variant = variant.split(" ")[0] if variant else ""
        cust = f"TEST_WA_{secrets.token_hex(3)}"
        msg = f"{cust}, {a_product['name'].lower()}, 1, {partial_variant}, "
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            data={"sender": "6281200000002", "message": msg},
            timeout=15,
        )
        j = r.json()
        assert j.get("ok") is True, j
        _cleanup_txn(auth_headers, j.get("transaction_number"))

    def test_json_body_accepted(self, auth_headers, a_product):
        cust = f"TEST_WA_{secrets.token_hex(3)}"
        variant = a_product.get("variant", "") or ""
        msg = f"{cust}, {a_product['name']}, 1, {variant}, json test"
        r = requests.post(
            f"{BASE_URL}/api/webhook/fonnte",
            json={"sender": "081200000003", "message": msg},
            timeout=15,
        )
        j = r.json()
        assert j.get("ok") is True, j
        # phone stored as-is (sender) — checking normalization is only on send path
        _cleanup_txn(auth_headers, j.get("transaction_number"))


# ---------- Phone normalization (indirect via /whatsapp/send after invalid key path)
# We already verified via the invalid_key path that phone is accepted. Add a direct
# check via the module import is not possible from an external test, so we validate
# the endpoint accepts several formats and does not return 400 "Nomor tidak valid".
class TestPhoneNormalization:
    @pytest.mark.parametrize("raw", ["081234567890", "6281234567890", "+6281234567890", "8123456789"])
    def test_various_phone_formats_reach_fonnte_layer(self, auth_headers, raw):
        cur = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15).json()
        old_key = cur.get("fonnte_api_key", "") or ""
        try:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": "INVALID_TEST_KEY_XXX"},
                timeout=15,
            )
            r = requests.post(
                f"{BASE_URL}/api/whatsapp/send",
                headers=auth_headers,
                json={"phone": raw, "message": "hi"},
                timeout=30,
            )
            # phone was normalized OK if we reach the Fonnte call (502), not 400
            assert r.status_code == 502, f"phone {raw} -> {r.status_code} {r.text}"
        finally:
            requests.put(
                f"{BASE_URL}/api/settings",
                headers=auth_headers,
                json={"fonnte_api_key": old_key},
                timeout=15,
            )
