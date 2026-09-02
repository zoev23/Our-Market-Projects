# Our Project Market — Frozen Food POS & ERP

## Original problem
Web app modern untuk mengelola penjualan, produk, supplier price list, stock, cashflow, dan laporan bisnis frozen food. Fungsi: POS, Product Management, Supplier Price Management, Inventory, Receipt, Sales Report, Cashflow.

## User choices
- Auth: JWT admin login (satu akun)
- Currency: Rupiah (Rp), locale id-ID
- No product photos (placeholder icon)
- Theme: dark default, toggleable ke light
- Responsive: mobile & desktop
- Seed data: Frozen Food Supplier (Risoles/Cireng Gendud/Lumpia Ubee)

## Personas
- Owner/admin toko frozen food yang butuh POS cepat & rekap otomatis

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT via cookie + Bearer
- Frontend: React 19 + React Router + shadcn/ui + Recharts + sonner
- All backend routes prefixed `/api`

## What's implemented (2026-02)
- Auth: login/logout/me dengan seed admin mrseptianno@gmail.com / admin123
- Dashboard: 7 summary cards, trend chart, top products, low-stock alert
- POS: product grid dengan search + kategori filter, cart, discount, cash + change, complete order, receipt dialog + print
- Products: full CRUD, auto profit & margin calc
- Suppliers: full CRUD, list produk terhubung
- Supplier Prices: full CRUD dengan price history (partial PUT ok)
- Inventory: stock adjust dengan alasan + audit history
- Transactions: list, detail, cetak ulang struk
- Reports: filter periode, chart harian, top products, performa kategori
- Cashflow: income otomatis + expense manual (kategorized)
- Settings: nama toko, alamat, telepon, footer struk, tema
- Sidebar desktop + bottom nav mobile + collapsible sheet

## Backlog / Next
- P1: Upload logo toko & tampilkan di struk
- P1: Ekspor laporan ke PDF/CSV
- P2: Diskon per-item & voucher
- P2: Multi-cashier login (role cashier)
- P2: Customer database + point loyalitas
