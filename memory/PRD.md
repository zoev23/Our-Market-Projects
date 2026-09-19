# BekuMart POS — Product Requirements Document

## Original Problem Statement
Web App Cashflow & POS untuk bisnis Frozen Food.
Fitur inti: Dashboard, POS/Kasir, Product Management, Supplier Management, Inventory/Stock, Thermal Receipt, Sales Reports, Cashflow, Settings.

## Product Requirements (fixed)
- Admin login JWT tunggal (Bahasa Indonesia UI, currency Rupiah)
- No product photo (text-based only)
- Light default + dark mode toggle
- Seed data supplier Frozen Food (Risoles, Cireng Gendud, Lumpia Ubee)
- Responsive mobile + desktop
- Cashless only (QRIS, Transfer) — tidak ada Tunai/Debit

## Architecture
- Backend: FastAPI + MongoDB (Motor). Routes under `/api`.
- Frontend: React + Tailwind + Shadcn UI + Axios + xlsx + jspdf + html2canvas.
- Auth: JWT cookie + bearer header fallback.
- Deployment: hot reload via supervisor; env vars in `.env`.

## Implemented Features (as of 2026-02)
- **Auth**: JWT login, seed admin
- **Products**: CRUD text-only, categories & suppliers linked, inline add Kategori & Supplier di form
- **POS/Kasir**:
  - Split mode: **Titipan Supplier** vs **Stok Sendiri** (produk dengan supplier vs tanpa supplier)
  - Cart: nama pembeli, tanggal transaksi opsional, per-item note
  - **Biaya Tambahan** di keranjang: Ongkir, Packing, Biaya Goreng (default dari Settings, override manual)
  - Payment: hanya QRIS + Transfer (Cash/Debit dihapus)
  - Backend menolak keranjang campuran (Supplier + Stok Sendiri)
  - Profit rule:
    - `supplier`: profit = total - cost (menerima biaya barang dari supplier)
    - `own_stock`: profit = total (biaya sudah tercatat via restock/expense manual)
- **Inventory**: stock adjust + history
- **Cashflow**:
  - Pemasukan manual (Modal, Investasi, Pinjaman, Refund, Bonus)
  - Pengeluaran (Restock, Packaging, Operational, dll)
  - 3 kartu ringkas: Total Pemasukan (Sales + Manual), Total Pengeluaran, Laba Bersih
- **Transactions**:
  - Edit, Delete (restore stock), Excel export
  - Badge source_type (Supplier / Stok Sendiri), via WA, diedit
- **Receipt**: 80mm thermal, ongkir/packing/goreng di struk & pesan WA, JPG/PNG/print export
- **Dashboard**: filter periode (Today, Yesterday, 7d, MTD, Last Month, All-time, Custom) + kartu statis Total Omzet
- **Reports**: buyer recap, supplier recap (TXT + PDF tree)
- **WhatsApp**: Fonnte webhook + fallback wa.me
- **Settings**: toko, footer struk, Fonnte, tema, **default biaya (Ongkir/Packing/Goreng)**

## Data Models (Mongo collections)
- users, products, categories, suppliers, transactions, inventory_history, expenses, incomes, settings, supplier_prices, supplier_price_history

## Key API Endpoints
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/products|categories|suppliers|transactions`
- `POST /api/transactions` — payload sekarang menerima `shipping_fee`, `packing_fee`, `frying_fee`; response menambahkan `source_type`
- `GET /api/dashboard/summary?start_date=&end_date=`
- `GET /api/reports/buyer-recap|supplier-recap`
- `GET/POST/DELETE /api/expenses|incomes`
- `GET/PUT /api/settings` — mendukung `default_shipping_fee`, `default_packing_fee`, `default_frying_fee`
- `POST /api/whatsapp/send`, `POST /api/webhook/fonnte`

## Roadmap (P1/P2 Backlog)
- P1 Bulk Import Data (Products/Stock/Expenses via XLSX)
- P1 Auto-log restock ke expenses (opsional agar user tak perlu manual)
- P2 Persist Sorting Preferences (localStorage)
- P2 Cashflow Excel Export
- P2 Dashboard PDF/PNG Export
- P2 Filter Periode di Cashflow
- P2 Widget Target Omzet Bulanan

## Known Notes / Guardrails
- Backend menolak keranjang campuran source_type — UI di POS juga block via tab switch confirm.
- Data lama dengan `payment_method` "Tunai" / "Debit" tetap ditampilkan (read-only fallback di edit dialog).
- Semua UI wajib Bahasa Indonesia.
- File edits harus pakai `mcp_search_replace` untuk file existing.
