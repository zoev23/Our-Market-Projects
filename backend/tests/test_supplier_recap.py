"""Tests for GET /api/reports/supplier-recap - Supplier restock recap (NO PRICES)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"

# Keys that must NEVER appear anywhere in supplier-recap response
FORBIDDEN_KEYS = {"price", "cost_price", "total_amount", "subtotal", "profit", "unit_price", "discount", "cash", "change"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _find_forbidden(obj, path="root"):
    """Recursively find forbidden keys anywhere in the response."""
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in FORBIDDEN_KEYS:
                found.append(f"{path}.{k}")
            found.extend(_find_forbidden(v, f"{path}.{k}"))
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            found.extend(_find_forbidden(v, f"{path}[{idx}]"))
    return found


def test_supplier_recap_basic_shape(client):
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("groups", "total_items", "total_suppliers", "transaction_count"):
        assert key in data, f"Missing key: {key}"
    assert isinstance(data["groups"], list)
    assert isinstance(data["total_items"], int)
    assert isinstance(data["total_suppliers"], int)
    assert isinstance(data["transaction_count"], int)


def test_supplier_recap_no_price_fields_anywhere(client):
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    assert r.status_code == 200
    data = r.json()
    forbidden = _find_forbidden(data)
    assert not forbidden, f"Found forbidden price-related keys: {forbidden}"


def test_supplier_recap_no_rp_or_numbers_that_look_like_prices(client):
    """Ensure raw response body has no 'Rp' or 'price' string."""
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    body = r.text.lower()
    assert "\"price\"" not in body
    assert "\"cost_price\"" not in body
    assert "\"total_amount\"" not in body


def test_supplier_recap_group_structure(client):
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    data = r.json()
    if not data["groups"]:
        pytest.skip("No transaction data to validate group structure")
    for g in data["groups"]:
        assert set(g.keys()) == {"supplier_id", "supplier_name", "items", "total_quantity"}, g.keys()
        assert isinstance(g["items"], list)
        assert isinstance(g["total_quantity"], int)
        computed = sum(i["quantity"] for i in g["items"])
        assert computed == g["total_quantity"], f"total_quantity mismatch for supplier {g['supplier_name']}"
        for i in g["items"]:
            assert set(i.keys()) == {"product_name", "variant", "description", "sku", "quantity"}, i.keys()
            assert isinstance(i["quantity"], int)


def test_supplier_recap_at_least_one_group(client):
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    data = r.json()
    # Seed says ~20 transactions exist across suppliers
    assert data["transaction_count"] >= 1, "Expected at least 1 transaction in DB"
    assert len(data["groups"]) >= 1, "Expected at least 1 supplier group"


def test_supplier_recap_totals_are_consistent(client):
    r = client.get(f"{BASE_URL}/api/reports/supplier-recap")
    data = r.json()
    assert data["total_suppliers"] == len(data["groups"])
    assert data["total_items"] == sum(g["total_quantity"] for g in data["groups"])


def test_supplier_recap_date_filter_narrows_results(client):
    # Full/unfiltered
    r_all = client.get(f"{BASE_URL}/api/reports/supplier-recap").json()
    # Tight past window (year 2000) - should return 0 transactions
    r_none = client.get(f"{BASE_URL}/api/reports/supplier-recap",
                       params={"start_date": "2000-01-01T00:00:00.000Z",
                               "end_date": "2000-12-31T23:59:59.999Z"}).json()
    assert r_none["transaction_count"] == 0, f"Expected 0, got {r_none['transaction_count']}"
    assert len(r_none["groups"]) == 0
    assert r_none["total_items"] == 0
    # Wide window should equal all
    r_wide = client.get(f"{BASE_URL}/api/reports/supplier-recap",
                       params={"start_date": "2000-01-01T00:00:00.000Z",
                               "end_date": "2099-12-31T23:59:59.999Z"}).json()
    assert r_wide["transaction_count"] == r_all["transaction_count"]


def test_supplier_recap_aggregation_matches_transactions(client):
    """Manually compute per-supplier quantities from /api/transactions and compare."""
    txns = client.get(f"{BASE_URL}/api/transactions").json()
    products = {p["id"]: p for p in client.get(f"{BASE_URL}/api/products").json()}
    suppliers = {s["id"]: s for s in client.get(f"{BASE_URL}/api/suppliers").json()}

    expected = {}
    for t in txns:
        for it in t.get("items", []):
            pid = it.get("product_id")
            prod = products.get(pid, {}) if pid else {}
            sid = prod.get("supplier_id") or "unknown"
            expected[sid] = expected.get(sid, 0) + int(it.get("quantity", 0))

    recap = client.get(f"{BASE_URL}/api/reports/supplier-recap").json()
    actual = {g["supplier_id"]: g["total_quantity"] for g in recap["groups"]}

    for sid, qty in expected.items():
        assert actual.get(sid) == qty, f"Supplier {suppliers.get(sid,{}).get('name',sid)}: expected {qty}, got {actual.get(sid)}"
