"""Backend tests for PUT /api/transactions/{tid} - transaction edit feature."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def products(client):
    r = client.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    return r.json()


def _create_txn(client, items):
    r = client.post(f"{BASE_URL}/api/transactions", json={
        "items": items, "discount": 0, "payment_method": "Tunai",
        "cash_received": 0, "customer_name": "TEST_EDIT"
    })
    assert r.status_code == 200, r.text
    return r.json()


def _get_stock(client, pid):
    r = client.get(f"{BASE_URL}/api/products")
    for p in r.json():
        if p["id"] == pid:
            return int(p["stock"])
    return None


# ---------- Happy path: edit qty preserves historical price ----------
def test_edit_transaction_preserves_historical_price_and_adjusts_stock(client, products):
    p = products[0]
    pid = p["id"]
    original_selling = float(p["selling_price"])
    # Create fresh transaction with qty=2
    txn = _create_txn(client, [{"product_id": pid, "quantity": 2, "note": ""}])
    tid = txn["id"]
    stock_after_create = _get_stock(client, pid)

    # Change product's current selling_price to 999999 to prove edit uses historical
    # Use current stock (post-sale) so update doesn't reset stock
    fresh = next(x for x in client.get(f"{BASE_URL}/api/products").json() if x["id"] == pid)
    upd_body = {**{k: fresh.get(k) for k in ["name","category_id","supplier_id","variant","cost_price","stock","minimum_stock","sku","status","description"]}, "selling_price": 999999.0}
    r = client.put(f"{BASE_URL}/api/products/{pid}", json=upd_body)
    assert r.status_code == 200

    # Edit txn: qty 2 -> 3
    r = client.put(f"{BASE_URL}/api/transactions/{tid}", json={
        "items": [{"product_id": pid, "quantity": 3, "note": "edited"}],
        "discount": 0, "payment_method": "QRIS", "cash_received": 0, "customer_name": "TEST_EDIT"
    })
    assert r.status_code == 200, r.text
    edited = r.json()
    # Historical price preserved
    assert edited["items"][0]["price"] == original_selling, f"Expected historical {original_selling}, got {edited['items'][0]['price']}"
    assert edited["items"][0]["quantity"] == 3
    assert edited["subtotal"] == original_selling * 3
    assert edited["total_amount"] == original_selling * 3
    assert edited.get("edited_by") == ADMIN_EMAIL
    assert edited.get("payment_method") == "QRIS"

    # Stock reduced by delta=1
    stock_after_edit = _get_stock(client, pid)
    assert stock_after_edit == stock_after_create - 1, f"Expected {stock_after_create-1}, got {stock_after_edit}"

    # inventory_history has type='edit' with reason mentioning txn number
    r = client.get(f"{BASE_URL}/api/inventory/history")
    assert r.status_code == 200
    hist = r.json()
    matches = [h for h in hist if h.get("type") == "edit" and txn["transaction_number"] in (h.get("reason") or "")]
    assert len(matches) >= 1, "No inventory_history entry with type='edit' for this txn"

    # Restore original price
    client.put(f"{BASE_URL}/api/products/{pid}", json={**upd_body, "selling_price": original_selling})


# ---------- Empty items ----------
def test_edit_empty_items_returns_400(client, products):
    pid = products[1]["id"]
    txn = _create_txn(client, [{"product_id": pid, "quantity": 1, "note": ""}])
    r = client.put(f"{BASE_URL}/api/transactions/{txn['id']}", json={
        "items": [], "discount": 0, "payment_method": "Tunai", "cash_received": 0, "customer_name": ""
    })
    assert r.status_code == 400
    assert "minimal 1 item" in r.json()["detail"]


def test_edit_all_zero_qty_returns_400(client, products):
    pid = products[1]["id"]
    txn = _create_txn(client, [{"product_id": pid, "quantity": 1, "note": ""}])
    r = client.put(f"{BASE_URL}/api/transactions/{txn['id']}", json={
        "items": [{"product_id": pid, "quantity": 0, "note": ""}],
        "discount": 0, "payment_method": "Tunai", "cash_received": 0, "customer_name": ""
    })
    assert r.status_code == 400
    assert "minimal 1 item" in r.json()["detail"]


# ---------- New item add rejected ----------
def test_edit_add_new_item_returns_400(client, products):
    p1, p2 = products[2], products[3]
    txn = _create_txn(client, [{"product_id": p1["id"], "quantity": 1, "note": ""}])
    r = client.put(f"{BASE_URL}/api/transactions/{txn['id']}", json={
        "items": [
            {"product_id": p1["id"], "quantity": 1, "note": ""},
            {"product_id": p2["id"], "quantity": 1, "note": ""},
        ],
        "discount": 0, "payment_method": "Tunai", "cash_received": 0, "customer_name": ""
    })
    assert r.status_code == 400
    assert "Menambah item baru" in r.json()["detail"]


# ---------- Insufficient stock ----------
def test_edit_exceed_stock_returns_400(client, products):
    p = products[4]
    pid = p["id"]
    txn = _create_txn(client, [{"product_id": pid, "quantity": 1, "note": ""}])
    current_stock = _get_stock(client, pid)
    # available = current_stock + old_qty(1). Request current_stock + 1 + 5 to exceed.
    huge = current_stock + 1 + 100
    r = client.put(f"{BASE_URL}/api/transactions/{txn['id']}", json={
        "items": [{"product_id": pid, "quantity": huge, "note": ""}],
        "discount": 0, "payment_method": "Tunai", "cash_received": 0, "customer_name": ""
    })
    assert r.status_code == 400
    assert "Stok tidak cukup" in r.json()["detail"]


# ---------- qty=0 removes item and returns stock ----------
def test_edit_qty_zero_removes_item_and_returns_stock(client, products):
    p1, p2 = products[5], products[6]
    txn = _create_txn(client, [
        {"product_id": p1["id"], "quantity": 2, "note": ""},
        {"product_id": p2["id"], "quantity": 1, "note": ""},
    ])
    stock_p1_before = _get_stock(client, p1["id"])

    r = client.put(f"{BASE_URL}/api/transactions/{txn['id']}", json={
        "items": [
            {"product_id": p1["id"], "quantity": 0, "note": ""},  # remove
            {"product_id": p2["id"], "quantity": 1, "note": ""},
        ],
        "discount": 0, "payment_method": "Tunai", "cash_received": 0, "customer_name": ""
    })
    assert r.status_code == 200, r.text
    data = r.json()
    pids = [i["product_id"] for i in data["items"]]
    assert p1["id"] not in pids
    assert len(data["items"]) == 1
    # Stock returned (+2)
    stock_p1_after = _get_stock(client, p1["id"])
    assert stock_p1_after == stock_p1_before + 2
