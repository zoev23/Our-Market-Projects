import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { ShoppingBag, DollarSign, Receipt, Package, Boxes, Wallet, TrendingUp, AlertTriangle, CalendarRange } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const RANGES = {
  today: { label: "Hari Ini", compute: () => { const s = new Date(); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  yesterday: { label: "Kemarin", compute: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); return { start: s.toISOString(), end: e.toISOString() }; } },
  week: { label: "7 Hari Terakhir", compute: () => { const s = new Date(); s.setDate(s.getDate()-7); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  month: { label: "Bulan Ini", compute: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  last_month: { label: "Bulan Lalu", compute: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59); return { start: s.toISOString(), end: e.toISOString() }; } },
  all: { label: "Semua Waktu", compute: () => ({ start: "1970-01-01T00:00:00Z", end: new Date().toISOString() }) },
  custom: { label: "Custom", compute: () => ({}) },
};

const cards = [
  { key: "period_sales", label: "Item Terjual", icon: ShoppingBag, color: "text-orange-500" },
  { key: "period_revenue", label: "Omzet", icon: DollarSign, color: "text-emerald-500", money: true },
  { key: "period_transactions", label: "Transaksi", icon: Receipt, color: "text-blue-500" },
  { key: "period_net_profit", label: "Laba Bersih", icon: TrendingUp, color: "text-amber-500", money: true },
  { key: "period_expense", label: "Pengeluaran", icon: Wallet, color: "text-rose-500", money: true },
  { key: "total_product", label: "Total Produk", icon: Package, color: "text-purple-500", static: true },
  { key: "total_stock", label: "Total Stok", icon: Boxes, color: "text-cyan-500", static: true },
  { key: "total_revenue_all", label: "Total Omzet Sepanjang Masa", icon: DollarSign, color: "text-emerald-500", money: true, static: true },
];

export default function Dashboard() {
  const [range, setRange] = useState("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);

  const activeRange = useMemo(() => {
    if (range === "custom") {
      return {
        start: customStart ? new Date(customStart).toISOString() : undefined,
        end: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined,
      };
    }
    return RANGES[range].compute();
  }, [range, customStart, customEnd]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeRange.start) params.set("start_date", activeRange.start);
    if (activeRange.end) params.set("end_date", activeRange.end);
    api.get(`/dashboard/summary?${params.toString()}`).then((r) => setData(r.data));
  }, [activeRange.start, activeRange.end]);

  const rangeLabel = () => {
    if (range === "custom") {
      if (!customStart && !customEnd) return "Semua Waktu";
      return `${customStart ? formatDate(customStart) : "Awal"} – ${customEnd ? formatDate(customEnd) : "Sekarang"}`;
    }
    return RANGES[range].label;
  };

  if (!data) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Ringkasan bisnis frozen food untuk periode <span className="font-medium text-foreground">{rangeLabel()}</span>.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div>
            <Label className="text-xs flex items-center gap-1.5"><CalendarRange size={13} />Periode</Label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="sm:w-48 mt-1" data-testid="dashboard-range"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RANGES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div>
                <Label className="text-xs">Dari</Label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="dashboard-start" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Sampai</Label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="dashboard-end" className="mt-1" />
              </div>
            </>
          )}
        </div>
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
                {c.money ? formatRp(val) : Number(val).toLocaleString("id-ID")}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {c.static ? "Sepanjang masa" : rangeLabel()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">Tren Penjualan & Laba — {rangeLabel()}</h3>
          <div className="h-64">
            {data.series.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Belum ada data di periode ini.</div>
            ) : (
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
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-base font-semibold mb-4">Top Selling — {rangeLabel()}</h3>
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
