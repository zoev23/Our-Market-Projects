import { useEffect, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tab, setTab] = useState("stock");
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ product_id: "", quantity: 0, reason: "Restock", notes: "" });

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/inventory/history").then((r) => setHistory(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
  };
  useEffect(load, []);

  const openAdj = (p) => { setAdjForm({ product_id: p.id, quantity: 0, reason: "Restock", notes: "" }); setAdjOpen(true); };

  const submitAdj = async () => {
    try {
      await api.post("/inventory/adjust", { ...adjForm, quantity: Number(adjForm.quantity) });
      toast.success("Stok berhasil diupdate"); setAdjOpen(false); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const status = (p) => {
    if (p.stock <= 0) return { label: "Habis", cls: "bg-destructive/10 text-destructive" };
    if (p.stock <= p.minimum_stock) return { label: "Stok Menipis", cls: "bg-amber-500/10 text-amber-500" };
    return { label: "Tersedia", cls: "bg-emerald-500/10 text-emerald-500" };
  };

  return (
    <div className="space-y-4" data-testid="inventory-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stok / Inventoris</h1>
        <p className="text-sm text-muted-foreground mt-1">Pantau dan sesuaikan stok produk.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab("stock")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "stock" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Stok</button>
        <button onClick={() => setTab("history")} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Riwayat</button>
      </div>

      {tab === "stock" ? (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Modal</th>
                <th className="px-4 py-3 font-medium">Stok</th>
                <th className="px-4 py-3 font-medium">Min</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const st = status(p);
                const sup = suppliers.find((s) => s.id === p.supplier_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.variant}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{sup?.name || "-"}</td>
                    <td className="px-4 py-3 font-mono">{formatRp(p.cost_price)}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{p.stock}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{p.minimum_stock}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => openAdj(p)} data-testid={`inv-adjust-${p.id}`}>Sesuaikan</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50"><tr className="text-left"><th className="px-4 py-3 font-medium">Tanggal</th><th className="px-4 py-3 font-medium">Produk</th><th className="px-4 py-3 font-medium">Tipe</th><th className="px-4 py-3 font-medium">Jumlah</th><th className="px-4 py-3 font-medium">Alasan</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">{formatDateTime(h.created_at)}</td>
                  <td className="px-4 py-3"><div className="font-medium">{h.product_name}</div><div className="text-xs text-muted-foreground">{h.variant}</div></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded ${h.quantity > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>{h.type}</span></td>
                  <td className={`px-4 py-3 font-mono font-semibold ${h.quantity > 0 ? "text-emerald-500" : "text-rose-500"}`}>{h.quantity > 0 ? "+" : ""}{h.quantity}</td>
                  <td className="px-4 py-3">{h.reason}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada riwayat.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sesuaikan Stok</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Jumlah (+ tambah / − kurang)</Label><Input type="number" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} data-testid="adj-qty" /></div>
            <div><Label>Alasan</Label>
              <Select value={adjForm.reason} onValueChange={(v) => setAdjForm({ ...adjForm, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Restock">Restock</SelectItem><SelectItem value="Damaged">Rusak</SelectItem><SelectItem value="Expired">Expired</SelectItem><SelectItem value="Correction">Koreksi</SelectItem><SelectItem value="Other">Lainnya</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Catatan</Label><Textarea value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdjOpen(false)}>Batal</Button><Button onClick={submitAdj} data-testid="adj-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
