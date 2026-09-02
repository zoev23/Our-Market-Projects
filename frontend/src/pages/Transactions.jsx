import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Receipt as ReceiptIcon, Eye, Search } from "lucide-react";
import Receipt from "../components/Receipt";

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get("/transactions").then((r) => setItems(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
  }, []);

  const filtered = items.filter((t) => !search || `${t.transaction_number} ${t.customer_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4" data-testid="transactions-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground mt-1">Semua transaksi penjualan.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. transaksi atau pelanggan..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <ReceiptIcon size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Belum ada transaksi.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50"><tr className="text-left"><th className="px-4 py-3 font-medium">No. Transaksi</th><th className="px-4 py-3 font-medium">Tanggal</th><th className="px-4 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Pembayaran</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Laba</th><th className="px-4 py-3 font-medium text-right">Aksi</th></tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{t.transaction_number}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(t.created_at)}</td>
                  <td className="px-4 py-3">{t.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{t.payment_method}</span></td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatRp(t.total_amount)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-500">{formatRp(t.profit)}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setSelected(t)} className="p-1.5 hover:bg-secondary rounded" data-testid={`txn-view-${t.id}`}><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detail Transaksi</DialogTitle></DialogHeader>
          <Receipt txn={selected} settings={settings} onClose={() => setSelected(null)} showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
