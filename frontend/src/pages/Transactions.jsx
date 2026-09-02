import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Receipt as ReceiptIcon, Eye, Search, Pencil, Plus, Minus, Trash2 } from "lucide-react";
import Receipt from "../components/Receipt";
import { toast } from "sonner";

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(null); // form state
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/transactions").then((r) => setItems(r.data));
  useEffect(() => {
    load();
    api.get("/settings").then((r) => setSettings(r.data));
  }, []);

  const filtered = items.filter((t) => !search || `${t.transaction_number} ${t.customer_name || ""}`.toLowerCase().includes(search.toLowerCase()));

  const openEdit = (t) => {
    setEditing({
      id: t.id,
      transaction_number: t.transaction_number,
      customer_name: t.customer_name || "",
      payment_method: t.payment_method || "Tunai",
      discount: t.discount || 0,
      cash_received: t.cash_received || 0,
      items: t.items.map((i) => ({ ...i })),
    });
  };

  const setItemQty = (pid, qty) => {
    setEditing((e) => ({ ...e, items: e.items.map((i) => i.product_id === pid ? { ...i, quantity: Math.max(0, qty) } : i) }));
  };
  const setItemNote = (pid, note) => {
    setEditing((e) => ({ ...e, items: e.items.map((i) => i.product_id === pid ? { ...i, note } : i) }));
  };
  const removeItem = (pid) => {
    setEditing((e) => ({ ...e, items: e.items.filter((i) => i.product_id !== pid) }));
  };

  const totals = useMemo(() => {
    if (!editing) return null;
    const kept = editing.items.filter((i) => i.quantity > 0);
    const subtotal = kept.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = Number(editing.discount) || 0;
    const total_amount = Math.max(subtotal - discount, 0);
    const cash = Number(editing.cash_received) || 0;
    const change = Math.max(cash - total_amount, 0);
    return { subtotal, total_amount, change, itemCount: kept.length };
  }, [editing]);

  const save = async () => {
    if (!editing) return;
    if (!totals || totals.itemCount === 0) { toast.error("Transaksi harus punya minimal 1 item"); return; }
    setSaving(true);
    try {
      await api.put(`/transactions/${editing.id}`, {
        items: editing.items.filter((i) => i.quantity > 0).map((i) => ({ product_id: i.product_id, quantity: i.quantity, note: i.note || "" })),
        discount: Number(editing.discount) || 0,
        payment_method: editing.payment_method,
        cash_received: Number(editing.cash_received) || 0,
        customer_name: editing.customer_name || "",
      });
      toast.success("Transaksi berhasil diperbarui");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" data-testid="transactions-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground mt-1">Semua transaksi penjualan. Klik ikon pensil untuk mengedit detail.</p>
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
                  <td className="px-4 py-3 font-mono text-xs">
                    {t.transaction_number}
                    {t.edited_by && <div className="text-[10px] text-amber-500 mt-0.5">diedit</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(t.created_at)}</td>
                  <td className="px-4 py-3">{t.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded">{t.payment_method}</span></td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatRp(t.total_amount)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-500">{formatRp(t.profit)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setSelected(t)} className="p-1.5 hover:bg-secondary rounded" data-testid={`txn-view-${t.id}`} title="Lihat struk"><Eye size={14} /></button>
                      <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-secondary rounded text-primary" data-testid={`txn-edit-${t.id}`} title="Edit transaksi"><Pencil size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt view dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detail Transaksi</DialogTitle></DialogHeader>
          <Receipt txn={selected} settings={settings} onClose={() => setSelected(null)} showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Transaksi {editing?.transaction_number}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nama Pelanggan</Label>
                  <Input value={editing.customer_name} onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} data-testid="edit-customer" />
                </div>
                <div>
                  <Label className="text-xs">Metode Pembayaran</Label>
                  <Select value={editing.payment_method} onValueChange={(v) => setEditing({ ...editing, payment_method: v })}>
                    <SelectTrigger data-testid="edit-payment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai">Tunai</SelectItem>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                      <SelectItem value="Transfer">Transfer Bank</SelectItem>
                      <SelectItem value="Debit">Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">Item Transaksi</div>
                <div className="space-y-2">
                  {editing.items.length === 0 && <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Semua item telah dihapus. Tambahkan minimal 1 item untuk menyimpan.</div>}
                  {editing.items.map((i) => (
                    <div key={i.product_id} className="border border-border rounded-lg p-3 space-y-2" data-testid={`edit-item-${i.product_id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{i.product_name}</div>
                          <div className="text-xs text-muted-foreground">{i.variant} • {formatRp(i.price)}</div>
                        </div>
                        <button onClick={() => removeItem(i.product_id)} className="text-destructive hover:opacity-70 p-1" title="Hapus item" data-testid={`edit-item-remove-${i.product_id}`}><Trash2 size={14} /></button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setItemQty(i.product_id, i.quantity - 1)} data-testid={`edit-item-dec-${i.product_id}`}><Minus size={13} /></Button>
                          <Input type="number" value={i.quantity} onChange={(e) => setItemQty(i.product_id, parseInt(e.target.value || "0", 10))} className="w-16 h-8 text-center font-mono" data-testid={`edit-item-qty-${i.product_id}`} />
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setItemQty(i.product_id, i.quantity + 1)} data-testid={`edit-item-inc-${i.product_id}`}><Plus size={13} /></Button>
                        </div>
                        <div className="text-sm font-mono font-semibold">{formatRp(i.price * i.quantity)}</div>
                      </div>
                      <Textarea
                        value={i.note || ""}
                        onChange={(e) => setItemNote(i.product_id, e.target.value)}
                        placeholder="Catatan item (opsional)..."
                        rows={2}
                        className="text-xs resize-none"
                        data-testid={`edit-item-note-${i.product_id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Diskon</Label>
                  <Input type="number" value={editing.discount} onChange={(e) => setEditing({ ...editing, discount: e.target.value })} data-testid="edit-discount" />
                </div>
                <div>
                  <Label className="text-xs">Uang Diterima</Label>
                  <Input type="number" value={editing.cash_received} onChange={(e) => setEditing({ ...editing, cash_received: e.target.value })} data-testid="edit-cash" />
                </div>
              </div>

              {totals && (
                <div className="bg-secondary/40 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatRp(totals.subtotal)}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span className="font-mono text-primary" data-testid="edit-total">{formatRp(totals.total_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-mono text-emerald-500">{formatRp(totals.change)}</span></div>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground italic">
                Catatan: mengubah jumlah item akan otomatis menyesuaikan stok produk. Harga item mengikuti harga asli saat transaksi terjadi.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="edit-cancel">Batal</Button>
            <Button onClick={save} disabled={saving} data-testid="edit-save">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
