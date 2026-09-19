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

## Implemented Features (2026-02)
- **Auth**: JWT login, seed admin
- **Products**:
  - CRUD text-only
  - Inline **+ Kategori Baru** dan **+ Supplier Baru** di dalam dropdown form Tambah Produk (sentinel Select item + mini dialog, auto-select setelah dibuat)
- **POS/Kasir**:
  - Tab **Titipan Supplier** vs **Stok Sendiri** (produk difilter otomatis by supplier_id)
  - Cart: nama pembeli, tanggal opsional, per-item note
  - **Biaya Tambahan** di keranjang: Ongkir, Packing, Biaya Goreng (default dari Settings)
  - Payment: hanya QRIS + Transfer (Cash/Debit dihapus, tidak ada input Uang Diterima/Kembalian)
  - Backend menolak mix supplier + own_stock
  - Profit: `own_stock` → total; `supplier` → total - cost
- **Inventory**: stock adjust + history
- **Cashflow**: 3 kartu (Total Pemasukan, Total Pengeluaran, Laba Bersih)
- **Transactions**:
  - Edit dengan **tambah produk baru** di dialog edit, dedup check, delete + restore stock
  - Fees inputs dalam edit (ongkir/packing/goreng)
  - Excel export
  - Badge source_type (Supplier / Stok Sendiri), via WA, diedit
- **Receipt**: 80mm thermal, ongkir/packing/goreng di struk & pesan WA
- **Dashboard**: filter periode (Today, Yesterday, 7d, MTD, Last Month, All-time, Custom)
- **Reports**: buyer recap, supplier recap (TXT + PDF tree)
- **WhatsApp**: Fonnte webhook + fallback wa.me
- **Settings**: toko, footer struk, Fonnte, tema, **default biaya (Ongkir/Packing/Goreng)**

## Key API Endpoints
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/products|categories|suppliers|transactions`
- `POST /api/transactions` — payload menerima `shipping_fee`, `packing_fee`, `frying_fee`; response `source_type`
- `PUT /api/transactions/{id}` — sekarang boleh tambah produk baru, block duplikat product_id, otomatis update stok delta
- `GET /api/dashboard/summary?start_date=&end_date=`
- `GET /api/reports/buyer-recap|supplier-recap`
- `GET/POST/DELETE /api/expenses|incomes`
- `GET/PUT /api/settings` — mendukung `default_shipping_fee|packing_fee|frying_fee`
- `POST /api/whatsapp/send`, `POST /api/webhook/fonnte`

## Roadmap
- P1 Auto-log restock ke expenses (opsional, biar Laba Bersih akurat tanpa input dua kali)
- P1 Bulk Import Data (Products/Stock/Expenses via XLSX)
- P2 Persist Sorting Preferences (localStorage)
- P2 Cashflow Excel Export
- P2 Dashboard PDF/PNG Export
- P2 Filter Periode di Cashflow
- P2 Widget Target Omzet Bulanan

## Guardrails
- Backend menolak keranjang campuran source_type; UI POS memberi konfirmasi saat tab switch dengan keranjang isi.
- Data lama dengan `payment_method` "Tunai" / "Debit" tetap tampil (read-only fallback di edit dialog).
- Semua UI Bahasa Indonesia.
- File edits pakai `mcp_search_replace` untuk existing files.
