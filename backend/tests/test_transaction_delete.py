"""Backend tests for DELETE /api/transactions/{tid} + buyer-recap price-leak regression."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = "mrseptianno@gmail.com"
PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


def _pick_products(client, n=2):
    r = client.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    prods = [p for p in r.json() if int(p.get("stock", 0)) > 5]
    assert len(prods) >= n, "Not enough stocked products"
    return prods[:n]


# --- DELETE /api/transactions/{tid} ---

def test_delete_transaction_restores_stock_and_history(client):
    prods = _pick_products(client, 2)
    stock_before = {p["id"]: int(p["stock"]) for p in prods}

    # create throwaway txn
    payload = {
        "customer_name": "TEST_DELETE_" + os.urandom(3).hex(),
        "payment_method": "Tunai",
        "discount": 0,
        "cash_received": 0,
        "items": [
            {"product_id": prods[0]["id"], "quantity": 2, "note": "TEST del A"},
            {"product_id": prods[1]["id"], "quantity": 3, "note": "TEST del B"},
        ],
    }
    r = client.post(f"{BASE_URL}/api/transactions", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    txn = r.json()
    tid = txn["id"]
    txn_number = txn["transaction_number"]

    # stock decremented
    r = client.get(f"{BASE_URL}/api/products", timeout=15)
    pmap = {p["id"]: p for p in r.json()}
    assert int(pmap[prods[0]["id"]]["stock"]) == stock_before[prods[0]["id"]] - 2
    assert int(pmap[prods[1]["id"]]["stock"]) == stock_before[prods[1]["id"]] - 3

    # DELETE
    r = client.delete(f"{BASE_URL}/api/transactions/{tid}", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("restored_items") == 2

    # gone
    r = client.get(f"{BASE_URL}/api/transactions/{tid}", timeout=15)
    assert r.status_code == 404

    # stock restored
    r = client.get(f"{BASE_URL}/api/products", timeout=15)
    pmap = {p["id"]: p for p in r.json()}
    assert int(pmap[prods[0]["id"]]["stock"]) == stock_before[prods[0]["id"]]
    assert int(pmap[prods[1]["id"]]["stock"]) == stock_before[prods[1]["id"]]

    # inventory_history has type='delete' entries referencing the txn number.
    # NOTE: transaction_number generation is `TRX-YYYYMMDD-<count>` where count = total txn count,
    # so numbers can be reused after deletes. Filter additionally by product_id set to isolate our run.
    r = client.get(f"{BASE_URL}/api/inventory/history", timeout=15)
    assert r.status_code == 200
    hist = r.json()
    our_pids = {prods[0]["id"], prods[1]["id"]}
    del_rows = [h for h in hist
                if h.get("type") == "delete"
                and h.get("reason") == f"Hapus transaksi {txn_number}"
                and h.get("product_id") in our_pids]
    assert len(del_rows) >= 2, f"expected >=2 delete rows for {txn_number}, got {len(del_rows)}"
    # verify our two products both have a delete row with the right qty
    qty_by_pid = {prods[0]["id"]: 2, prods[1]["id"]: 3}
    for pid, expected_qty in qty_by_pid.items():
        matching = [h for h in del_rows if h.get("product_id") == pid and h.get("quantity") == expected_qty]
        assert matching, f"no delete-history row for pid={pid} qty={expected_qty}"


def test_delete_transaction_not_found(client):
    r = client.delete(f"{BASE_URL}/api/transactions/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404
    detail = r.json().get("detail", "")
    assert "Transaksi tidak ditemukan" in detail


# --- Regression: buyer-recap no price leak ---

FORBIDDEN_PRICE_KEYS = {"price", "cost_price", "selling_price", "subtotal", "total_amount",
                        "total_price", "cash_received", "discount", "profit", "unit_price"}


def _scan(obj, path="root"):
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in FORBIDDEN_PRICE_KEYS:
                hits.append(f"{path}.{k}")
            hits += _scan(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += _scan(v, f"{path}[{i}]")
    return hits


def test_buyer_recap_no_price_fields(client):
    r = client.get(f"{BASE_URL}/api/reports/buyer-recap", timeout=20)
    assert r.status_code == 200, r.text
    hits = _scan(r.json())
    assert not hits, f"Price-like fields leaked in buyer-recap: {hits[:20]}"
