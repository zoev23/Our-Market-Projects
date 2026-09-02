"""Dashboard summary date-range filter tests."""
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
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


def test_default_today(client):
    r = client.get(f"{BASE_URL}/api/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    assert d.get("default_today") is True
    for k in [
        "period_sales", "period_revenue", "period_transactions", "period_profit_gross",
        "period_expense", "period_net_profit",
        "total_transactions_all", "total_revenue_all", "total_profit_all",
        "total_expense_all", "estimated_profit_all",
        "total_product", "total_stock", "series", "top_products",
        "start_date", "end_date",
    ]:
        assert k in d, f"missing key: {k}"
    assert d["start_date"] and d["end_date"]
    # period vals must be <= all-time
    assert d["period_revenue"] <= d["total_revenue_all"]
    assert d["period_transactions"] <= d["total_transactions_all"]


def test_full_range_equals_all_time(client):
    r = client.get(
        f"{BASE_URL}/api/dashboard/summary",
        params={"start_date": "2020-01-01T00:00:00Z", "end_date": "2030-01-01T00:00:00Z"},
    )
    assert r.status_code == 200
    d = r.json()
    assert d.get("default_today") is False
    assert d["period_revenue"] == d["total_revenue_all"]
    assert d["period_transactions"] == d["total_transactions_all"]
    assert d["period_profit_gross"] == d["total_profit_all"]


def test_series_and_top_from_period(client):
    """Narrow range in far past should have empty series/top_products but nonzero all-time totals (if data exists)."""
    r = client.get(
        f"{BASE_URL}/api/dashboard/summary",
        params={"start_date": "1999-01-01T00:00:00Z", "end_date": "1999-01-02T00:00:00Z"},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["period_transactions"] == 0
    assert d["series"] == []
    assert d["top_products"] == []
    # All-time totals still present
    assert "total_revenue_all" in d


def test_backward_compat_aliases(client):
    r = client.get(f"{BASE_URL}/api/dashboard/summary")
    d = r.json()
    assert d["total_sales_today"] == d["period_sales"]
    assert d["revenue_today"] == d["period_revenue"]
    assert d["profit_today"] == d["period_profit_gross"]
    assert d["total_revenue"] == d["total_revenue_all"]
    assert d["total_transaction"] == d["total_transactions_all"]
    assert d["total_expense"] == d["total_expense_all"]
    assert d["estimated_profit"] == d["estimated_profit_all"]


def test_invalid_dates_no_500(client):
    r = client.get(
        f"{BASE_URL}/api/dashboard/summary",
        params={"start_date": "not-a-date", "end_date": "also-bad"},
    )
    assert r.status_code < 500
