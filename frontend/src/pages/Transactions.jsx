import { useEffect, useState } from "react";
import api from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Receipt, Eye, Printer, Search } from "lucide-react";

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
          <Receipt size={40} className="mx-auto text-muted-foreground mb-3" />
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Detail Transaksi</DialogTitle></DialogHeader>
          {selected && settings && (
            <div className="print-receipt text-xs font-mono bg-white text-black p-4 rounded">
              <div className="text-center border-b border-dashed border-black pb-2">
                <div className="font-bold text-sm">{settings.store_name}</div>
                <div>{settings.address}</div><div>{settings.phone}</div>
              </div>
              <div className="py-2 border-b border-dashed border-black">
                <div>No: {selected.transaction_number}</div>
                <div>Tgl: {formatDateTime(selected.created_at)}</div>
              </div>
              <div className="py-2 border-b border-dashed border-black space-y-1">
                {selected.items.map((i, idx) => (
                  <div key={idx}>
                    <div>{i.product_name} {i.variant && `- ${i.variant}`}</div>
                    <div className="flex justify-between"><span>{i.quantity} x {formatRp(i.price)}</span><span>{formatRp(i.subtotal)}</span></div>
                  </div>
                ))}
              </div>
              <div className="py-2 space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(selected.subtotal)}</span></div>
                <div className="flex justify-between"><span>Diskon</span><span>{formatRp(selected.discount)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatRp(selected.total_amount)}</span></div>
                <div className="flex justify-between"><span>{selected.payment_method}</span><span>{formatRp(selected.cash_received)}</span></div>
                <div className="flex justify-between"><span>Kembali</span><span>{formatRp(selected.change_amount)}</span></div>
              </div>
              <div className="pt-2 border-t border-dashed border-black text-center">{settings.receipt_footer}</div>
            </div>
          )}
          <DialogFooter><Button onClick={() => window.print()}><Printer size={16} className="mr-2" />Cetak Ulang</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
