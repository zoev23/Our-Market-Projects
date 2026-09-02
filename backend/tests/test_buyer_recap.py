"""Tests for GET /api/reports/buyer-recap - Buyer recap grouped by customer_name (NO PRICES)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"

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


def test_buyer_recap_basic_shape(client):
    r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("groups", "total_items", "total_buyers", "transaction_count"):
        assert key in data, f"Missing key: {key}"
    assert isinstance(data["groups"], list)
    assert isinstance(data["total_items"], int)
    assert isinstance(data["total_buyers"], int)
    assert isinstance(data["transaction_count"], int)


def test_buyer_recap_no_forbidden_keys(client):
    r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
    forbidden = _find_forbidden(r.json())
    assert not forbidden, f"Found forbidden keys: {forbidden}"


def test_buyer_recap_no_rp_in_body(client):
    r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
    body = r.text
    assert "\"price\"" not in body.lower()
    assert "Rp" not in body


def test_buyer_recap_group_structure(client):
    r = client.get(f"{BASE_URL}/api/reports/buyer-recap")
    data = r.json()
    if not data["groups"]:
        pytest.skip("No transactions")
    for g in data["groups"]:
        assert set(g.keys()) == {"customer_name", "transaction_count", "total_quantity", "items"}, g.keys()
        assert isinstance(g["items"], list)
        assert isinstance(g["transaction_count"], int)
        assert isinstance(g["total_quantity"], int)
        computed = sum(i["quantity"] for i in g["items"])
        assert computed == g["total_quantity"]
        for it in g["items"]:
            assert set(it.keys()) == {"product_name", "variant", "description", "sku", "quantity"}, it.keys()
            assert isinstance(it["quantity"], int)


def test_buyer_recap_totals_consistent(client):
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    assert data["total_buyers"] == len(data["groups"])
    assert data["total_items"] == sum(g["total_quantity"] for g in data["groups"])


def test_buyer_recap_empty_customer_grouped_as_pelanggan_umum(client):
    """Transactions with empty customer_name should be grouped under 'Pelanggan Umum'."""
    txns = client.get(f"{BASE_URL}/api/transactions").json()
    has_empty = any(not (t.get("customer_name") or "").strip() for t in txns)
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    names = [g["customer_name"] for g in data["groups"]]
    if has_empty:
        assert "Pelanggan Umum" in names, f"Expected 'Pelanggan Umum' in groups, got {names}"


def test_buyer_recap_named_customers_present(client):
    """Named customers should appear as their own group."""
    txns = client.get(f"{BASE_URL}/api/transactions").json()
    named = set((t.get("customer_name") or "").strip() for t in txns if (t.get("customer_name") or "").strip())
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    names = set(g["customer_name"] for g in data["groups"])
    for n in named:
        assert n in names, f"Expected named buyer '{n}' in groups, got {names}"


def test_buyer_recap_aggregation_matches(client):
    """Manual per-buyer aggregation should match the recap output."""
    txns = client.get(f"{BASE_URL}/api/transactions").json()
    expected = {}
    txn_counts = {}
    for t in txns:
        cust = (t.get("customer_name") or "").strip() or "Pelanggan Umum"
        txn_counts[cust] = txn_counts.get(cust, 0) + 1
        for it in t.get("items", []):
            expected[cust] = expected.get(cust, 0) + int(it.get("quantity", 0))
    recap = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    actual = {g["customer_name"]: g["total_quantity"] for g in recap["groups"]}
    actual_tc = {g["customer_name"]: g["transaction_count"] for g in recap["groups"]}
    for cust, qty in expected.items():
        assert actual.get(cust) == qty, f"Buyer {cust}: expected qty {qty}, got {actual.get(cust)}"
        assert actual_tc.get(cust) == txn_counts[cust], f"Buyer {cust}: expected {txn_counts[cust]} txns, got {actual_tc.get(cust)}"


def test_buyer_recap_merges_same_buyer(client):
    """Same buyer name across multiple transactions merges into ONE group."""
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    names = [g["customer_name"] for g in data["groups"]]
    assert len(names) == len(set(names)), f"Duplicate buyer groups found: {names}"


def test_buyer_recap_item_dedup_per_buyer(client):
    """Within a buyer group, (product_name, variant) tuples should be unique (deduped)."""
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    for g in data["groups"]:
        keys = [(i["product_name"], i["variant"]) for i in g["items"]]
        assert len(keys) == len(set(keys)), f"Duplicates in buyer {g['customer_name']}: {keys}"


def test_buyer_recap_date_filter(client):
    r_all = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    r_none = client.get(f"{BASE_URL}/api/reports/buyer-recap",
                       params={"start_date": "2000-01-01T00:00:00.000Z",
                               "end_date": "2000-12-31T23:59:59.999Z"}).json()
    assert r_none["transaction_count"] == 0
    assert len(r_none["groups"]) == 0
    assert r_none["total_items"] == 0
    r_wide = client.get(f"{BASE_URL}/api/reports/buyer-recap",
                       params={"start_date": "2000-01-01T00:00:00.000Z",
                               "end_date": "2099-12-31T23:59:59.999Z"}).json()
    assert r_wide["transaction_count"] == r_all["transaction_count"]
    assert r_wide["total_buyers"] == r_all["total_buyers"]


def test_buyer_recap_expected_seed_buyers(client):
    """Per review: expect at least 2 distinct buyer groups from seed."""
    data = client.get(f"{BASE_URL}/api/reports/buyer-recap").json()
    assert data["total_buyers"] >= 2, f"Expected >=2 buyer groups, got {data['total_buyers']}: {[g['customer_name'] for g in data['groups']]}"
