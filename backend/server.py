from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

app = FastAPI(title="BekuMart POS API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bekumart")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth utils ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SupplierIn(BaseModel):
    name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    status: Optional[str] = "active"


class CategoryIn(BaseModel):
    name: str


class ProductIn(BaseModel):
    name: str
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    variant: Optional[str] = ""
    cost_price: float = 0
    selling_price: float = 0
    stock: int = 0
    minimum_stock: int = 5
    sku: Optional[str] = ""
    status: Optional[str] = "active"
    description: Optional[str] = ""


class SupplierPriceIn(BaseModel):
    supplier_id: str
    product_id: Optional[str] = None
    product_name: str
    variant: Optional[str] = ""
    price: float
    minimum_order: Optional[int] = 1
    effective_date: Optional[str] = None
    notes: Optional[str] = ""


class SupplierPriceUpdate(BaseModel):
    supplier_id: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    variant: Optional[str] = None
    price: Optional[float] = None
    minimum_order: Optional[int] = None
    effective_date: Optional[str] = None
    notes: Optional[str] = None


class CartItem(BaseModel):
    product_id: str
    quantity: int
    note: Optional[str] = ""


class TransactionIn(BaseModel):
    items: List[CartItem]
    discount: float = 0
    payment_method: str = "Tunai"
    cash_received: float = 0
    customer_name: Optional[str] = ""


class TransactionUpdateItem(BaseModel):
    product_id: str
    quantity: int
    note: Optional[str] = ""


class TransactionUpdate(BaseModel):
    items: List[TransactionUpdateItem]
    discount: float = 0
    payment_method: str = "Tunai"
    cash_received: float = 0
    customer_name: Optional[str] = ""


class StockAdjustIn(BaseModel):
    product_id: str
    quantity: int  # positive add, negative subtract
    reason: str
    notes: Optional[str] = ""


class ExpenseIn(BaseModel):
    category: str
    description: Optional[str] = ""
    amount: float
    date: Optional[str] = None


class SettingsIn(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    receipt_footer: Optional[str] = None
    logo: Optional[str] = None


# ---------- Auth routes ----------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/"
    )
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Suppliers ----------
@api.get("/suppliers")
async def list_suppliers(user=Depends(get_current_user)):
    docs = await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return docs


@api.post("/suppliers")
async def create_supplier(body: SupplierIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, user=Depends(get_current_user)):
    upd = body.model_dump()
    r = await db.suppliers.update_one({"id": sid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Supplier tidak ditemukan")
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})


@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user=Depends(get_current_user)):
    await db.suppliers.delete_one({"id": sid})
    return {"ok": True}


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(user=Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@api.post("/categories")
async def create_category(body: CategoryIn, user=Depends(get_current_user)):
    doc = {"id": new_id(), "name": body.name, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(get_current_user)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ---------- Products ----------
@api.get("/products")
async def list_products(user=Depends(get_current_user)):
    return await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/products")
async def create_product(body: ProductIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, user=Depends(get_current_user)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    r = await db.products.update_one({"id": pid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Produk tidak ditemukan")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(get_current_user)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ---------- Supplier prices ----------
@api.get("/supplier-prices")
async def list_supplier_prices(user=Depends(get_current_user)):
    return await db.supplier_prices.find({}, {"_id": 0}).sort("product_name", 1).to_list(2000)


@api.post("/supplier-prices")
async def create_supplier_price(body: SupplierPriceIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["effective_date"] = doc.get("effective_date") or now_iso()
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.supplier_prices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/supplier-prices/{pid}")
async def update_supplier_price(pid: str, body: SupplierPriceUpdate, user=Depends(get_current_user)):
    old = await db.supplier_prices.find_one({"id": pid})
    if not old:
        raise HTTPException(404, "Price tidak ditemukan")
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = now_iso()
    if "price" in upd and float(old.get("price", 0)) != float(upd["price"]):
        await db.supplier_price_history.insert_one({
            "id": new_id(),
            "supplier_price_id": pid,
            "old_price": old["price"],
            "new_price": upd["price"],
            "changed_at": now_iso(),
            "changed_by": user["email"],
        })
    await db.supplier_prices.update_one({"id": pid}, {"$set": upd})
    return await db.supplier_prices.find_one({"id": pid}, {"_id": 0})


@api.delete("/supplier-prices/{pid}")
async def delete_supplier_price(pid: str, user=Depends(get_current_user)):
    await db.supplier_prices.delete_one({"id": pid})
    return {"ok": True}


@api.get("/supplier-prices/{pid}/history")
async def price_history(pid: str, user=Depends(get_current_user)):
    return await db.supplier_price_history.find({"supplier_price_id": pid}, {"_id": 0}).sort("changed_at", -1).to_list(500)


# ---------- Inventory ----------
@api.post("/inventory/adjust")
async def adjust_stock(body: StockAdjustIn, user=Depends(get_current_user)):
    prod = await db.products.find_one({"id": body.product_id})
    if not prod:
        raise HTTPException(404, "Produk tidak ditemukan")
    new_stock = int(prod.get("stock", 0)) + int(body.quantity)
    if new_stock < 0:
        raise HTTPException(400, "Stok tidak boleh negatif")
    await db.products.update_one({"id": body.product_id}, {"$set": {"stock": new_stock, "updated_at": now_iso()}})
    await db.inventory_history.insert_one({
        "id": new_id(),
        "product_id": body.product_id,
        "product_name": prod.get("name"),
        "variant": prod.get("variant"),
        "type": "in" if body.quantity > 0 else "out",
        "quantity": body.quantity,
        "reason": body.reason,
        "notes": body.notes,
        "created_at": now_iso(),
        "user_email": user["email"],
    })
    return {"ok": True, "new_stock": new_stock}


@api.get("/inventory/history")
async def inventory_history(user=Depends(get_current_user)):
    return await db.inventory_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ---------- Transactions ----------
@api.post("/transactions")
async def create_transaction(body: TransactionIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Tidak ada item")
    line_items = []
    subtotal = 0.0
    total_cost = 0.0
    for item in body.items:
        prod = await db.products.find_one({"id": item.product_id})
        if not prod:
            raise HTTPException(404, f"Produk tidak ditemukan")
        if int(prod.get("stock", 0)) < item.quantity:
            raise HTTPException(400, f"Stok tidak cukup untuk {prod['name']}")
        price = float(prod.get("selling_price", 0))
        cost = float(prod.get("cost_price", 0))
        sub = price * item.quantity
        cost_sub = cost * item.quantity
        line_items.append({
            "product_id": prod["id"],
            "product_name": prod["name"],
            "variant": prod.get("variant", ""),
            "quantity": item.quantity,
            "price": price,
            "cost_price": cost,
            "subtotal": sub,
            "profit": sub - cost_sub,
            "note": (item.note or "").strip(),
        })
        subtotal += sub
        total_cost += cost_sub

    discount = float(body.discount or 0)
    total_amount = max(subtotal - discount, 0)
    profit = total_amount - total_cost
    cash_received = float(body.cash_received or total_amount)
    change_amount = max(cash_received - total_amount, 0)

    # decrement stock
    for item in body.items:
        await db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}, "$set": {"updated_at": now_iso()}})
        prod = await db.products.find_one({"id": item.product_id})
        await db.inventory_history.insert_one({
            "id": new_id(),
            "product_id": item.product_id,
            "product_name": prod.get("name"),
            "variant": prod.get("variant"),
            "type": "sale",
            "quantity": -item.quantity,
            "reason": "Sale",
            "created_at": now_iso(),
            "user_email": user["email"],
        })

    # generate txn number
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.transactions.count_documents({}) + 1
    txn_number = f"TRX-{today}-{count:05d}"

    doc = {
        "id": new_id(),
        "transaction_number": txn_number,
        "items": line_items,
        "subtotal": subtotal,
        "discount": discount,
        "total_amount": total_amount,
        "total_cost": total_cost,
        "profit": profit,
        "payment_method": body.payment_method,
        "cash_received": cash_received,
        "change_amount": change_amount,
        "customer_name": body.customer_name or "",
        "cashier_email": user["email"],
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/transactions")
async def list_transactions(
    user=Depends(get_current_user),
    limit: int = 200,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    q = {}
    if start_date or end_date:
        q["created_at"] = {}
        if start_date:
            q["created_at"]["$gte"] = start_date
        if end_date:
            q["created_at"]["$lte"] = end_date
    docs = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/transactions/{tid}")
async def get_transaction(tid: str, user=Depends(get_current_user)):
    doc = await db.transactions.find_one({"id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    return doc


@api.put("/transactions/{tid}")
async def update_transaction(tid: str, body: TransactionUpdate, user=Depends(get_current_user)):
    old = await db.transactions.find_one({"id": tid})
    if not old:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    # Only allow editing existing items (qty>0 keeps; qty<=0 removes). No adding new products here.
    incoming = [i for i in body.items if i.quantity > 0]
    if not incoming:
        raise HTTPException(400, "Transaksi harus memiliki minimal 1 item")

    old_by_pid = {i["product_id"]: i for i in old.get("items", [])}
    new_by_pid = {i.product_id: i for i in incoming}

    # Reject unknown product_ids (would require new item add — out of scope)
    for pid in new_by_pid:
        if pid not in old_by_pid:
            raise HTTPException(400, "Menambah item baru tidak didukung saat edit")

    # Compute stock deltas. delta = new_qty - old_qty (positive = need more stock).
    stock_deltas = {}
    for pid, oi in old_by_pid.items():
        old_q = int(oi.get("quantity", 0))
        new_q = int(new_by_pid[pid].quantity) if pid in new_by_pid else 0
        d = new_q - old_q
        if d != 0:
            stock_deltas[pid] = d

    # Validate stock availability for any positive deltas
    for pid, d in stock_deltas.items():
        if d > 0:
            prod = await db.products.find_one({"id": pid})
            if not prod or int(prod.get("stock", 0)) < d:
                raise HTTPException(400, f"Stok tidak cukup untuk {prod.get('name') if prod else 'produk'}")

    # Apply stock deltas & log to inventory_history
    txn_number = old.get("transaction_number", tid)
    for pid, d in stock_deltas.items():
        await db.products.update_one({"id": pid}, {"$inc": {"stock": -d}, "$set": {"updated_at": now_iso()}})
        prod = await db.products.find_one({"id": pid})
        await db.inventory_history.insert_one({
            "id": new_id(),
            "product_id": pid,
            "product_name": prod.get("name"),
            "variant": prod.get("variant"),
            "type": "edit",
            "quantity": -d,
            "reason": f"Edit transaksi {txn_number}",
            "created_at": now_iso(),
            "user_email": user["email"],
        })

    # Rebuild line items using historical price/cost (preserve accounting accuracy)
    line_items = []
    subtotal = 0.0
    total_cost = 0.0
    for i in incoming:
        oi = old_by_pid[i.product_id]
        price = float(oi.get("price", 0))
        cost = float(oi.get("cost_price", 0))
        sub = price * i.quantity
        cost_sub = cost * i.quantity
        line_items.append({
            "product_id": i.product_id,
            "product_name": oi.get("product_name"),
            "variant": oi.get("variant", ""),
            "quantity": i.quantity,
            "price": price,
            "cost_price": cost,
            "subtotal": sub,
            "profit": sub - cost_sub,
            "note": (i.note or "").strip(),
        })
        subtotal += sub
        total_cost += cost_sub

    discount = float(body.discount or 0)
    total_amount = max(subtotal - discount, 0)
    profit = total_amount - total_cost
    cash_received = float(body.cash_received or total_amount)
    change_amount = max(cash_received - total_amount, 0)

    upd = {
        "items": line_items,
        "subtotal": subtotal,
        "discount": discount,
        "total_amount": total_amount,
        "total_cost": total_cost,
        "profit": profit,
        "payment_method": body.payment_method,
        "cash_received": cash_received,
        "change_amount": change_amount,
        "customer_name": body.customer_name or "",
        "updated_at": now_iso(),
        "edited_by": user["email"],
    }
    await db.transactions.update_one({"id": tid}, {"$set": upd})
    return await db.transactions.find_one({"id": tid}, {"_id": 0})


# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    return await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(1000)


@api.post("/expenses")
async def create_expense(body: ExpenseIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["date"] = doc.get("date") or now_iso()
    doc["created_at"] = now_iso()
    doc["user_email"] = user["email"]
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(get_current_user)):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}


# ---------- Settings ----------
@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not s:
        s = {
            "id": "default",
            "store_name": "BekuMart Frozen",
            "address": "Jl. Frozen No. 1, Jakarta",
            "phone": "0812-3456-7890",
            "receipt_footer": "Terima kasih atas pesanan Anda ❤",
            "logo": "",
        }
        await db.settings.insert_one(s)
        s.pop("_id", None)
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "default"}, {"$set": upd}, upsert=True)
    return await db.settings.find_one({"id": "default"}, {"_id": 0})


# ---------- Dashboard/Reports ----------
@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    all_txns = await db.transactions.find({}, {"_id": 0}).to_list(5000)
    today_txns = [t for t in all_txns if t.get("created_at", "").startswith(today)]
    total_sales_today = sum(sum(i["quantity"] for i in t.get("items", [])) for t in today_txns)
    revenue_today = sum(t.get("total_amount", 0) for t in today_txns)
    profit_today = sum(t.get("profit", 0) for t in today_txns)
    total_transaction = len(all_txns)
    products = await db.products.find({}, {"_id": 0}).to_list(2000)
    total_product = len(products)
    total_stock = sum(int(p.get("stock", 0)) for p in products)
    low_stock = [p for p in products if int(p.get("stock", 0)) <= int(p.get("minimum_stock", 5))]
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(2000)
    total_expense = sum(e.get("amount", 0) for e in expenses)
    total_revenue = sum(t.get("total_amount", 0) for t in all_txns)
    total_profit_all = sum(t.get("profit", 0) for t in all_txns)
    estimated_profit = total_profit_all - total_expense

    # Daily series last 7 days
    daily = {}
    for t in all_txns:
        d = (t.get("created_at") or "")[:10]
        if not d:
            continue
        daily.setdefault(d, {"date": d, "revenue": 0, "profit": 0, "transactions": 0})
        daily[d]["revenue"] += t.get("total_amount", 0)
        daily[d]["profit"] += t.get("profit", 0)
        daily[d]["transactions"] += 1
    for e in expenses:
        d = (e.get("date") or "")[:10]
        if not d:
            continue
        daily.setdefault(d, {"date": d, "revenue": 0, "profit": 0, "transactions": 0, "expense": 0})
        daily[d]["expense"] = daily[d].get("expense", 0) + e.get("amount", 0)
    series = sorted(daily.values(), key=lambda x: x["date"])[-14:]

    # Top selling
    top = {}
    for t in all_txns:
        for i in t.get("items", []):
            key = i["product_name"] + (f" - {i['variant']}" if i.get("variant") else "")
            top.setdefault(key, {"name": key, "qty": 0, "revenue": 0})
            top[key]["qty"] += i["quantity"]
            top[key]["revenue"] += i["subtotal"]
    top_products = sorted(top.values(), key=lambda x: x["qty"], reverse=True)[:5]

    return {
        "total_sales_today": total_sales_today,
        "revenue_today": revenue_today,
        "profit_today": profit_today,
        "total_transaction": total_transaction,
        "total_product": total_product,
        "total_stock": total_stock,
        "total_expense": total_expense,
        "estimated_profit": estimated_profit,
        "total_revenue": total_revenue,
        "low_stock_products": [{"id": p["id"], "name": p["name"], "variant": p.get("variant", ""), "stock": p.get("stock", 0), "minimum_stock": p.get("minimum_stock", 5)} for p in low_stock[:10]],
        "series": series,
        "top_products": top_products,
    }


@api.get("/reports")
async def reports(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    q = {}
    if start_date or end_date:
        q["created_at"] = {}
        if start_date:
            q["created_at"]["$gte"] = start_date
        if end_date:
            q["created_at"]["$lte"] = end_date
    txns = await db.transactions.find(q, {"_id": 0}).to_list(5000)
    total_revenue = sum(t.get("total_amount", 0) for t in txns)
    total_cost = sum(t.get("total_cost", 0) for t in txns)
    total_items = sum(sum(i["quantity"] for i in t.get("items", [])) for t in txns)
    gross_profit = total_revenue - total_cost
    avg_order = total_revenue / len(txns) if txns else 0

    eq = {}
    if start_date or end_date:
        eq["date"] = {}
        if start_date:
            eq["date"]["$gte"] = start_date
        if end_date:
            eq["date"]["$lte"] = end_date
    expenses = await db.expenses.find(eq, {"_id": 0}).to_list(2000)
    total_expense = sum(e.get("amount", 0) for e in expenses)
    net_profit = gross_profit - total_expense

    # daily series
    daily = {}
    for t in txns:
        d = (t.get("created_at") or "")[:10]
        daily.setdefault(d, {"date": d, "revenue": 0, "profit": 0, "transactions": 0})
        daily[d]["revenue"] += t.get("total_amount", 0)
        daily[d]["profit"] += t.get("profit", 0)
        daily[d]["transactions"] += 1

    # top products & category perf
    top = {}
    cats = {}
    products = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(2000)}
    categories = {c["id"]: c for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    for t in txns:
        for i in t.get("items", []):
            key = i["product_name"] + (f" - {i['variant']}" if i.get("variant") else "")
            top.setdefault(key, {"name": key, "qty": 0, "revenue": 0})
            top[key]["qty"] += i["quantity"]
            top[key]["revenue"] += i["subtotal"]
            p = products.get(i["product_id"], {})
            cat_id = p.get("category_id")
            cat_name = categories.get(cat_id, {}).get("name", "Lainnya") if cat_id else "Lainnya"
            cats.setdefault(cat_name, {"category": cat_name, "revenue": 0, "qty": 0})
            cats[cat_name]["revenue"] += i["subtotal"]
            cats[cat_name]["qty"] += i["quantity"]

    return {
        "total_revenue": total_revenue,
        "total_transactions": len(txns),
        "total_items_sold": total_items,
        "total_cost": total_cost,
        "gross_profit": gross_profit,
        "total_expense": total_expense,
        "net_profit": net_profit,
        "average_order_value": avg_order,
        "series": sorted(daily.values(), key=lambda x: x["date"]),
        "top_products": sorted(top.values(), key=lambda x: x["qty"], reverse=True)[:10],
        "category_performance": sorted(cats.values(), key=lambda x: x["revenue"], reverse=True),
    }


@api.get("/reports/supplier-recap")
async def supplier_recap(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    q = {}
    if start_date or end_date:
        q["created_at"] = {}
        if start_date:
            q["created_at"]["$gte"] = start_date
        if end_date:
            q["created_at"]["$lte"] = end_date
    txns = await db.transactions.find(q, {"_id": 0}).to_list(10000)
    products = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(2000)}
    suppliers = {s["id"]: s for s in await db.suppliers.find({}, {"_id": 0}).to_list(500)}

    agg = {}
    for t in txns:
        for i in t.get("items", []):
            pid = i.get("product_id")
            prod = products.get(pid, {}) if pid else {}
            sup_id = prod.get("supplier_id") or "unknown"
            sup_name = suppliers.get(sup_id, {}).get("name") or "Tanpa Supplier"
            key = (sup_id, pid or i.get("product_name"))
            if key not in agg:
                agg[key] = {
                    "supplier_id": sup_id,
                    "supplier_name": sup_name,
                    "product_id": pid,
                    "product_name": i.get("product_name"),
                    "variant": i.get("variant", ""),
                    "notes": [],
                    "sku": prod.get("sku", ""),
                    "quantity": 0,
                }
            agg[key]["quantity"] += int(i.get("quantity", 0))
            note = (i.get("note") or "").strip()
            if note and note not in agg[key]["notes"]:
                agg[key]["notes"].append(note)

    groups = {}
    for item in agg.values():
        sid = item["supplier_id"]
        groups.setdefault(sid, {
            "supplier_id": sid,
            "supplier_name": item["supplier_name"],
            "items": [],
            "total_quantity": 0,
        })
        groups[sid]["items"].append({
            "product_name": item["product_name"],
            "variant": item["variant"],
            "description": " • ".join(item["notes"]),
            "sku": item["sku"],
            "quantity": item["quantity"],
        })
        groups[sid]["total_quantity"] += item["quantity"]

    result = list(groups.values())
    for g in result:
        g["items"].sort(key=lambda x: (x["product_name"], x["variant"]))
    result.sort(key=lambda g: g["supplier_name"])
    return {
        "start_date": start_date,
        "end_date": end_date,
        "groups": result,
        "total_items": sum(g["total_quantity"] for g in result),
        "total_suppliers": len(result),
        "transaction_count": len(txns),
    }


@api.get("/reports/buyer-recap")
async def buyer_recap(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    q = {}
    if start_date or end_date:
        q["created_at"] = {}
        if start_date:
            q["created_at"]["$gte"] = start_date
        if end_date:
            q["created_at"]["$lte"] = end_date
    txns = await db.transactions.find(q, {"_id": 0}).to_list(10000)
    products = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(2000)}

    buyers = {}
    for t in txns:
        cust = (t.get("customer_name") or "").strip() or "Pelanggan Umum"
        if cust not in buyers:
            buyers[cust] = {
                "customer_name": cust,
                "transaction_count": 0,
                "items_by_key": {},
                "total_quantity": 0,
            }
        buyers[cust]["transaction_count"] += 1
        for i in t.get("items", []):
            pid = i.get("product_id") or ""
            key = (pid, i.get("product_name", ""), i.get("variant", ""))
            if key not in buyers[cust]["items_by_key"]:
                prod = products.get(pid, {}) if pid else {}
                buyers[cust]["items_by_key"][key] = {
                    "product_name": i.get("product_name"),
                    "variant": i.get("variant", ""),
                    "notes": [],
                    "sku": prod.get("sku", ""),
                    "quantity": 0,
                }
            buyers[cust]["items_by_key"][key]["quantity"] += int(i.get("quantity", 0))
            note = (i.get("note") or "").strip()
            if note and note not in buyers[cust]["items_by_key"][key]["notes"]:
                buyers[cust]["items_by_key"][key]["notes"].append(note)
            buyers[cust]["total_quantity"] += int(i.get("quantity", 0))

    groups = []
    for b in buyers.values():
        items = sorted(b["items_by_key"].values(), key=lambda x: (x["product_name"], x["variant"]))
        groups.append({
            "customer_name": b["customer_name"],
            "transaction_count": b["transaction_count"],
            "total_quantity": b["total_quantity"],
            "items": [
                {
                    "product_name": it["product_name"],
                    "variant": it["variant"],
                    "description": " • ".join(it["notes"]),
                    "sku": it["sku"],
                    "quantity": it["quantity"],
                }
                for it in items
            ],
        })
    groups.sort(key=lambda g: g["customer_name"].lower())
    return {
        "start_date": start_date,
        "end_date": end_date,
        "groups": groups,
        "total_buyers": len(groups),
        "total_items": sum(g["total_quantity"] for g in groups),
        "transaction_count": len(txns),
    }


@api.get("/cashflow/summary")
async def cashflow_summary(user=Depends(get_current_user)):
    txns = await db.transactions.find({}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(2000)
    total_income = sum(t.get("total_amount", 0) for t in txns)
    total_expense = sum(e.get("amount", 0) for e in expenses)
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net_cashflow": total_income - total_expense,
    }


# ---------- Seed ----------
async def seed_data():
    # admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin BekuMart",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # skip re-seeding if data exists
    if await db.suppliers.count_documents({}) > 0:
        return

    # Categories
    cats = [
        {"id": new_id(), "name": "Risoles", "created_at": now_iso()},
        {"id": new_id(), "name": "Cireng Gendud", "created_at": now_iso()},
        {"id": new_id(), "name": "Lumpia Ubee", "created_at": now_iso()},
    ]
    await db.categories.insert_many(cats)
    cat_map = {c["name"]: c["id"] for c in cats}

    # Supplier
    supplier = {
        "id": new_id(),
        "name": "Frozen Food Supplier",
        "contact_person": "Bapak Frozen",
        "phone": "0812-1111-2222",
        "address": "Jakarta",
        "notes": "Supplier utama Risoles, Cireng, dan Lumpia.",
        "status": "active",
        "created_at": now_iso(),
    }
    await db.suppliers.insert_one(supplier)

    def sell_price(cost: int) -> int:
        return int(round(cost * 1.3 / 1000)) * 1000

    seed_products = [
        # (category, name, variant, cost)
        ("Risoles", "Risoles", "Coklat Keju", 20000),
        ("Risoles", "Risoles", "Matcha Keju", 20000),
        ("Risoles", "Risoles", "Tiramissu Keju", 20000),
        ("Risoles", "Risoles", "Mayoo", 21000),
        ("Risoles", "Risoles", "Bolognese", 21000),
        ("Risoles", "Risoles", "Carbonara", 22000),
        ("Risoles", "Risoles", "Mix Manis (Coklat, Matcha, Tiramissu)", 22000),
        ("Risoles", "Risoles", "Mix Gurih (Mayoo, Bolognese, Carbonara)", 24000),
        ("Risoles", "Risoles", "Mix All Varian / Request", 25000),
        ("Cireng Gendud", "Cireng Gendud", "Ayam Ori", 21000),
        ("Cireng Gendud", "Cireng Gendud", "Ayam Pedas", 21000),
        ("Cireng Gendud", "Cireng Gendud", "Bakso Pedas", 21000),
        ("Cireng Gendud", "Cireng Gendud", "Jando Pedas", 22000),
        ("Cireng Gendud", "Cireng Gendud", "Mix 2 Varian", 25000),
        ("Lumpia Ubee", "Lumpia Ubee", "Coklat Lumer", 12000),
    ]

    for cat, name, variant, cost in seed_products:
        sp = sell_price(cost)
        prod_id = new_id()
        await db.products.insert_one({
            "id": prod_id,
            "name": name,
            "category_id": cat_map[cat],
            "supplier_id": supplier["id"],
            "variant": variant,
            "cost_price": cost,
            "selling_price": sp,
            "stock": 20,
            "minimum_stock": 5,
            "sku": f"{name[:3].upper()}-{variant[:3].upper()}",
            "status": "active",
            "description": "",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        await db.supplier_prices.insert_one({
            "id": new_id(),
            "supplier_id": supplier["id"],
            "product_id": prod_id,
            "product_name": name,
            "variant": variant,
            "price": cost,
            "minimum_order": 1,
            "effective_date": now_iso(),
            "notes": "",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })

    # default settings
    await db.settings.insert_one({
        "id": "default",
        "store_name": "BekuMart Frozen",
        "address": "Jl. Frozen No. 1, Jakarta",
        "phone": "0812-3456-7890",
        "receipt_footer": "Terima kasih atas pesanan Anda ❤",
        "logo": "",
    })


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.suppliers.create_index("id", unique=True)
    await db.transactions.create_index("id", unique=True)
    await seed_data()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
