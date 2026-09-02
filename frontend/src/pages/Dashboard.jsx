import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { ShoppingBag, DollarSign, Receipt, Package, Boxes, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";

const cards = [
  { key: "total_sales_today", label: "Item Terjual Hari Ini", icon: ShoppingBag, color: "text-orange-500" },
  { key: "revenue_today", label: "Omzet Hari Ini", icon: DollarSign, color: "text-emerald-500", money: true },
  { key: "total_transaction", label: "Total Transaksi", icon: Receipt, color: "text-blue-500" },
  { key: "total_product", label: "Total Produk", icon: Package, color: "text-purple-500" },
  { key: "total_stock", label: "Total Stok", icon: Boxes, color: "text-cyan-500" },
  { key: "total_expense", label: "Total Pengeluaran", icon: Wallet, color: "text-rose-500", money: true },
  { key: "estimated_profit", label: "Estimasi Laba Bersih", icon: TrendingUp, color: "text-amber-500", money: true },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/summary").then((r) => setData(r.data)); }, []);
  if (!data) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan bisnis frozen food Anda hari ini.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const val = data[c.key] || 0;
          return (
            <div key={c.key} data-testid={`summary-${c.key}`} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="text-xs text-muted-foreground font-medium">{c.label}</div>
                <c.icon size={18} className={c.color} />
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-bold font-mono tracking-tight">
                {c.money ? formatRp(val) : val.toLocaleString("id-ID")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">Tren Penjualan & Laba</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v) => formatRp(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Omzet" />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={false} name="Laba" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">Top Selling Products</h3>
          {data.top_products.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada penjualan.</div>
          ) : (
            <div className="space-y-3">
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-secondary grid place-items-center text-xs font-bold">{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.qty} terjual</div>
                  </div>
                  <div className="text-xs font-mono font-semibold">{formatRp(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.low_stock_products.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5" data-testid="low-stock-alert">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-base font-semibold">Peringatan Stok Menipis</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.low_stock_products.map((p) => (
              <div key={p.id} className="text-sm flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                <div className="truncate">{p.name} <span className="text-muted-foreground">— {p.variant}</span></div>
                <div className="font-mono font-semibold text-amber-500">{p.stock}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
