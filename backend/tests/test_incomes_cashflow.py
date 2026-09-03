"""Tests for Income CRUD + Cashflow summary breakdown (iteration 14)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-pos-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mrseptianno@gmail.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_incomes_list_ok(h):
    r = requests.get(f"{BASE_URL}/api/incomes", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_income_create_get_delete(h):
    # baseline
    s0 = requests.get(f"{BASE_URL}/api/cashflow/summary", headers=h).json()
    base_manual = s0["total_income_manual"]
    base_net = s0["net_cashflow"]

    # create
    payload = {"category": "Modal Awal", "description": "QA_INCOME_TEST", "amount": 500000}
    r = requests.post(f"{BASE_URL}/api/incomes", headers=h, json=payload)
    assert r.status_code == 200, r.text
    inc = r.json()
    assert inc["amount"] == 500000
    assert inc["description"] == "QA_INCOME_TEST"
    assert "id" in inc and "created_at" in inc and "user_email" in inc
    iid = inc["id"]

    # list contains
    lst = requests.get(f"{BASE_URL}/api/incomes", headers=h).json()
    assert any(x["id"] == iid for x in lst)
    # sort desc by date
    dates = [x.get("date", "") for x in lst if x.get("date")]
    assert dates == sorted(dates, reverse=True)

    # summary changed
    s1 = requests.get(f"{BASE_URL}/api/cashflow/summary", headers=h).json()
    assert s1["total_income_manual"] == base_manual + 500000
    assert s1["net_cashflow"] == base_net + 500000
    assert s1["total_income"] == s1["total_income_sales"] + s1["total_income_manual"]

    # delete
    d = requests.delete(f"{BASE_URL}/api/incomes/{iid}", headers=h)
    assert d.status_code == 200
    assert d.json() == {"ok": True}

    lst2 = requests.get(f"{BASE_URL}/api/incomes", headers=h).json()
    assert not any(x["id"] == iid for x in lst2)


def test_incomes_require_auth():
    r = requests.get(f"{BASE_URL}/api/incomes")
    assert r.status_code in (401, 403)
    r = requests.post(f"{BASE_URL}/api/incomes",
                      json={"category": "x", "description": "y", "amount": 1})
    assert r.status_code in (401, 403)


def test_cashflow_summary_shape(h):
    r = requests.get(f"{BASE_URL}/api/cashflow/summary", headers=h)
    assert r.status_code == 200
    j = r.json()
    for k in ["total_income", "total_income_sales", "total_income_manual",
              "total_expense", "net_cashflow"]:
        assert k in j, f"missing {k}"
