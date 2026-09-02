import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { formatRp } from "../lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const RANGES = {
  today: () => { const d = new Date(); const s = new Date(d.setHours(0,0,0,0)); return { start: s.toISOString(), end: new Date().toISOString() }; },
  yesterday: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = new Date(d.setHours(0,0,0,0)); const e = new Date(d.setHours(23,59,59,999)); return { start: s.toISOString(), end: e.toISOString() }; },
  week: () => { const d = new Date(); d.setDate(d.getDate() - 7); return { start: d.toISOString(), end: new Date().toISOString() }; },
  month: () => { const d = new Date(); d.setDate(1); const s = new Date(d.setHours(0,0,0,0)); return { start: s.toISOString(), end: new Date().toISOString() }; },
  last_month: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); return { start: s.toISOString(), end: e.toISOString() }; },
  all: () => ({}),
};

export default function Reports() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => {
    const r = RANGES[range]();
    const params = new URLSearchParams();
    if (r.start) params.set("start_date", r.start);
    if (r.end) params.set("end_date", r.end);
    api.get(`/reports?${params.toString()}`).then((res) => setData(res.data));
  }, [range]);

  const cards = useMemo(() => data ? [
    { label: "Total Omzet", value: formatRp(data.total_revenue) },
    { label: "Transaksi", value: data.total_transactions.toLocaleString("id-ID") },
    { label: "Item Terjual", value: data.total_items_sold.toLocaleString("id-ID") },
    { label: "Total Modal", value: formatRp(data.total_cost) },
    { label: "Laba Kotor", value: formatRp(data.gross_profit) },
    { label: "Pengeluaran", value: formatRp(data.total_expense) },
    { label: "Laba Bersih", value: formatRp(data.net_profit) },
    { label: "AOV (Rata-rata)", value: formatRp(data.average_order_value) },
  ] : [], [data]);

  return (
    <div className="space-y-4" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Bisnis</h1>
          <p className="text-sm text-muted-foreground mt-1">Analisis performa penjualan dan laba.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="sm:w-48" data-testid="reports-range"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="yesterday">Kemarin</SelectItem>
            <SelectItem value="week">7 Hari Terakhir</SelectItem>
            <SelectItem value="month">Bulan Ini</SelectItem>
            <SelectItem value="last_month">Bulan Lalu</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!data ? <div className="text-muted-foreground">Memuat...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-lg font-bold font-mono">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-base font-semibold mb-4">Tren Harian</h3>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold mb-4">Top Produk</h3>
              <div className="space-y-2">
                {data.top_products.slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-secondary grid place-items-center text-xs font-bold">{i+1}</div>
                    <div className="flex-1 min-w-0 truncate text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.qty}</div>
                    <div className="text-xs font-mono font-semibold w-24 text-right">{formatRp(p.revenue)}</div>
                  </div>
                ))}
                {data.top_products.length === 0 && <div className="text-sm text-muted-foreground">Belum ada data.</div>}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-base font-semibold mb-4">Performa Kategori</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.category_performance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="category" fontSize={10} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                    <Tooltip formatter={(v) => formatRp(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
