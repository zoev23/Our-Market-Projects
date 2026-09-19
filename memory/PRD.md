# BekuMart POS — Product Requirements Document

## Original Problem Statement
Web App Cashflow & POS untuk bisnis Frozen Food.
Fitur inti: Dashboard, POS/Kasir, Product, Supplier, Inventory, Thermal Receipt, Sales Reports, Cashflow, Settings, Import Data.

## Product Requirements (fixed)
- Admin login JWT (Bahasa Indonesia UI, currency Rupiah)
- No product photo (text-based)
- Light default + dark mode
- Seed data Frozen Food (Risoles, Cireng Gendud, Lumpia Ubee)
- Responsive mobile + desktop
- Cashless only (QRIS, Transfer)

## Architecture
- Backend: FastAPI + MongoDB (Motor). Routes under `/api`.
- Frontend: React + Tailwind + Shadcn UI + Axios + xlsx + jspdf + html2canvas.

## Implemented Features (2026-02)
- **Auth**: JWT login, seed admin
- **Products**: Inline "+ Kategori Baru" & "+ Supplier Baru" di dropdown form
- **POS/Kasir**:
  - Tab Titipan Supplier vs Stok Sendiri
  - Cart fees: Ongkir, Packing, Biaya Goreng (default dari Settings)
  - Cashless only (QRIS + Transfer)
  - Profit: own_stock → total; supplier → total - cost
- **Inventory**:
  - Stock adjust + history
  - **Auto Restock Expense**: restock produk tanpa supplier otomatis catat expense = cost_price × qty
  - Preview banner di dialog "Sesuaikan Stok" menampilkan estimasi auto-expense
- **Cashflow**:
  - **Filter Periode** (Today/Yesterday/7d/Bulan Ini/Bulan Lalu/Semua/Custom) — sama seperti Dashboard
  - 3 kartu ringkas (Total Pemasukan / Pengeluaran / Laba Bersih)
  - Badge "auto" pada expense yang di-generate otomatis dari restock
- **Transactions**: Edit + tambah produk baru saat edit, dedup, delete restore stok, Excel export, badge source_type
- **Receipt**: 80mm thermal + fees + WhatsApp send
- **Dashboard**: Filter periode
- **Reports**: Buyer & Supplier recap
- **WhatsApp**: Fonnte + fallback wa.me
- **Settings**: Toko, Fonnte, tema, default fees
- **Import Data (baru)**: Upload .xlsx bulk untuk Produk / Stok / Pengeluaran
  - Template download per-tab
  - Preview 20 baris pertama sebelum submit
  - Kategori & Supplier auto-created saat import Produk
  - Stok import auto-log expense untuk produk tanpa supplier
  - Report hasil (created/applied + skipped rows)

## Key API Endpoints
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/products|categories|suppliers|transactions`
- `POST /api/inventory/adjust` — response `expense_created` ({id, amount}) jika auto-expense terpicu
- `GET /api/cashflow/summary?start_date=&end_date=`
- `POST /api/import/products|stock|expenses` — rows: [{...}], response {ok, created/applied, skipped}
- `GET /api/reports/buyer-recap|supplier-recap`
- `GET/POST/DELETE /api/expenses|incomes`
- `GET/PUT /api/settings`
- `POST /api/whatsapp/send`, `POST /api/webhook/fonnte`

## Roadmap
- P2 Persist sort preferences (localStorage)
- P2 Cashflow Excel Export
- P2 Dashboard PDF/PNG Export
- P2 Widget Target Omzet Bulanan
- P3 Undo delete auto-expense saat stock adjust dibatalkan
