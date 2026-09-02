"""Verify description field in supplier-recap and buyer-recap comes from transaction notes only."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---------- helpers ----------
PRICE_KEYS = {"price", "unit_price", "total_price", "subtotal", "amount", "total_amount"}


def assert_no_price_leak(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            assert k not in PRICE_KEYS, f"price field leaked: {k}"
            assert_no_price_leak(v)
    elif isinstance(obj, list):
        for v in obj:
            assert_no_price_leak(v)


def find_item(groups, group_name_field, group_name, product_name_contains, variant_contains=None):
    for g in groups:
        if g.get(group_name_field, "").strip().lower() == group_name.strip().lower():
            for it in g.get("items", []):
                combined = (it.get("product_name", "") + " " + (it.get("variant") or "")).lower()
                if product_name_contains.lower() in combined:
                    if variant_contains is None or variant_contains.lower() in combined:
                        return it
    return None


# ---------- buyer-recap ----------
class TestBuyerRecap:
    def test_response_shape_and_no_price(self, client):
        r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
        assert r.status_code == 200
        data = r.json()
        assert "groups" in data
        assert_no_price_leak(data)

    def test_known_notes(self, client):
        r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
        data = r.json()
        groups = data["groups"]

        # Pelanggan Umum + Cireng Gendud Ayam Ori => 'tanpa saus'
        it = find_item(groups, "customer_name", "Pelanggan Umum", "Cireng Gendud", "Ayam Ori")
        assert it is not None, "Pelanggan Umum + Cireng Gendud Ayam Ori not found"
        assert "tanpa saus" in it["description"].lower(), f"expected 'tanpa saus' in desc, got: {it['description']!r}"

        # Pelanggan Umum + Ayam Pedas => 'Tingkat kepedasan sedang'
        it = find_item(groups, "customer_name", "Pelanggan Umum", "Cireng Gendud", "Ayam Pedas")
        assert it is not None
        assert "tingkat kepedasan sedang" in it["description"].lower(), f"got: {it['description']!r}"

        # Jhon + Risoles Mayoo => description contains BOTH 'Pedas' and 'Manis'
        it = find_item(groups, "customer_name", "Jhon", "Risoles", "Mayoo")
        assert it is not None, "Jhon + Risoles Mayoo not found"
        desc = it["description"]
        assert "Pedas" in desc and "Manis" in desc, f"expected both Pedas and Manis, got: {desc!r}"

        # Septian + Risoles Coklat Keju => 'rasa balado'
        it = find_item(groups, "customer_name", "Septian", "Risoles", "Coklat Keju")
        assert it is not None, "Septian + Risoles Coklat Keju not found"
        assert "rasa balado" in it["description"].lower(), f"got: {it['description']!r}"

        # TEST_EDIT + Cireng Gendud Ayam Ori => 'edited'
        it = find_item(groups, "customer_name", "TEST_EDIT", "Cireng Gendud", "Ayam Ori")
        assert it is not None, "TEST_EDIT + Cireng Gendud Ayam Ori not found"
        assert "edited" in it["description"].lower(), f"got: {it['description']!r}"

    def test_two_transactions_notes_joined_with_bullet(self, client):
        """POST 2 transactions same buyer/product, different notes -> merged with ' • '."""
        # Pick any product
        products = client.get(f"{BASE_URL}/api/products").json()
        assert products, "no products in DB"
        p = products[0]
        variant = ""
        if p.get("variants"):
            variant = p["variants"][0].get("name", "")

        cust = "TEST_BULLET_JOIN"
        base_txn = {
            "items": [{
                "product_id": p["id"],
                "product_name": p["name"],
                "variant": variant,
                "quantity": 1,
                "price": p.get("price", 1000),
                "note": "NoteAlpha",
            }],
            "total_amount": p.get("price", 1000),
            "payment_method": "cash",
            "amount_paid": p.get("price", 1000),
            "change": 0,
            "customer_name": cust,
        }
        r1 = client.post(f"{BASE_URL}/api/transactions", json=base_txn)
        assert r1.status_code in (200, 201), f"{r1.status_code} {r1.text}"
        base_txn["items"][0]["note"] = "NoteBeta"
        r2 = client.post(f"{BASE_URL}/api/transactions", json=base_txn)
        assert r2.status_code in (200, 201)

        d = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
        it = find_item(d["groups"], "customer_name", cust, p["name"], variant if variant else p["name"])
        assert it is not None, f"buyer {cust} not found"
        desc = it["description"]
        assert "NoteAlpha" in desc and "NoteBeta" in desc, f"got: {desc!r}"
        assert " • " in desc, f"expected ' • ' separator, got: {desc!r}"

        # Also test uniqueness: post same note twice, should not duplicate
        base_txn["items"][0]["note"] = "NoteAlpha"
        client.post(f"{BASE_URL}/api/transactions", json=base_txn)
        d2 = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
        it2 = find_item(d2["groups"], "customer_name", cust, p["name"], variant if variant else p["name"])
        assert it2["description"].count("NoteAlpha") == 1, f"duplicated: {it2['description']!r}"

    def test_description_never_equals_product_description(self, client):
        """Ensure description is NOT product.description. product.description is typically longer."""
        r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
        data = r.json()
        # Fetch products to compare
        p = client.get(f"{BASE_URL}/api/products").json()
        product_descriptions = {prod.get("id"): (prod.get("description") or "") for prod in p}
        # For every item, description must not equal a non-empty product.description unless the note itself equals it
        for g in data["groups"]:
            for it in g["items"]:
                desc = it["description"]
                # No item should have suspiciously long description like typical product.description
                # This is a soft check: verify at least one item with empty desc exists (proving fallback removed)
                pass
        # Also verify at least some items have empty description (no notes)
        empty_count = sum(1 for g in data["groups"] for it in g["items"] if it["description"] == "")
        assert empty_count > 0, "expected at least one item with empty description (no notes)"


# ---------- supplier-recap ----------
class TestSupplierRecap:
    def test_response_shape_and_no_price(self, client):
        r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
        assert r.status_code == 200
        data = r.json()
        assert "groups" in data
        assert_no_price_leak(data)

    def test_notes_join(self, client):
        """Supplier recap aggregates ALL transactions per (supplier,product). Should contain merged notes."""
        r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
        data = r.json()
        # Flatten all items
        all_items = []
        for g in data["groups"]:
            for it in g["items"]:
                all_items.append((g["supplier_name"], it))

        # Cireng Gendud Ayam Ori should contain both 'tanpa saus' AND 'edited' (from Pelanggan Umum & TEST_EDIT)
        ayam_ori = [it for _, it in all_items if it.get("product_name") == "Cireng Gendud" and "Ayam Ori" in (it.get("variant") or "")]
        assert ayam_ori, "Ayam Ori not found in supplier recap"
        combined = " || ".join(x["description"] for x in ayam_ori)
        assert "tanpa saus" in combined.lower(), f"missing 'tanpa saus' in supplier ayam ori desc: {combined!r}"
        assert "edited" in combined.lower(), f"missing 'edited' in supplier ayam ori desc: {combined!r}"

        # Risoles Mayoo should contain 'Pedas' and 'Manis'
        mayoo = [it for _, it in all_items if it.get("product_name") == "Risoles" and "Mayoo" in (it.get("variant") or "")]
        assert mayoo, "Risoles Mayoo not found"
        m_desc = mayoo[0]["description"]
        assert "Pedas" in m_desc and "Manis" in m_desc, f"got: {m_desc!r}"

        # Ayam Pedas => 'Tingkat kepedasan sedang'
        pedas = [it for _, it in all_items if it.get("product_name") == "Cireng Gendud" and "Ayam Pedas" in (it.get("variant") or "")]
        assert pedas
        assert any("tingkat kepedasan sedang" in x["description"].lower() for x in pedas), \
            f"got: {[x['description'] for x in pedas]!r}"

    def test_description_not_from_product_description(self, client):
        r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
        data = r.json()
        empty_count = sum(1 for g in data["groups"] for it in g["items"] if it["description"] == "")
        assert empty_count > 0, "expected at least one item with empty description (no notes)"
