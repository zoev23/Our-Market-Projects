import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, History, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

const empty = { supplier_id: "", product_id: "", product_name: "", variant: "", price: 0, minimum_order: 1, notes: "" };

export default function SupplierPrices() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [supFilter, setSupFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);
  const [hist, setHist] = useState(null);

  const load = () => {
    api.get("/supplier-prices").then((r) => setItems(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
    api.get("/products").then((r) => setProducts(r.data));
  };
  useEffect(load, []);

  const filtered = useMemo(() => items.filter((p) => {
    if (supFilter !== "all" && p.supplier_id !== supFilter) return false;
    if (search && !(`${p.product_name} ${p.variant}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }), [items, supFilter, search]);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...empty, ...p }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...form, price: Number(form.price), minimum_order: Number(form.minimum_order) };
      if (editing) await api.put(`/supplier-prices/${editing.id}`, payload);
      else await api.post("/supplier-prices", payload);
      toast.success(editing ? "Harga diupdate" : "Harga ditambahkan"); setOpen(false); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try { await api.delete(`/supplier-prices/${delId}`); toast.success("Harga dihapus"); setDelId(null); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const showHistory = async (p) => {
    const { data } = await api.get(`/supplier-prices/${p.id}/history`);
    setHist({ price: p, history: data });
  };

  return (
    <div className="space-y-4" data-testid="prices-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Price List Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola harga modal dari supplier dan pantau perubahannya.</p>
        </div>
        <Button onClick={openAdd} data-testid="price-add"><Plus size={16} className="mr-1.5" />Tambah Harga</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..." className="pl-9" />
        </div>
        <Select value={supFilter} onValueChange={setSupFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Supplier</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <FileSpreadsheet size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Belum ada harga supplier.</p>
          <Button onClick={openAdd}><Plus size={16} className="mr-1.5" />Tambah Harga Pertama</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50"><tr className="text-left"><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Produk</th><th className="px-4 py-3 font-medium">Varian</th><th className="px-4 py-3 font-medium">Harga Modal</th><th className="px-4 py-3 font-medium">Min Order</th><th className="px-4 py-3 font-medium">Diperbarui</th><th className="px-4 py-3 font-medium text-right">Aksi</th></tr></thead>
            <tbody>
              {filtered.map((p) => {
                const sup = suppliers.find((s) => s.id === p.supplier_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">{sup?.name || "-"}</td>
                    <td className="px-4 py-3 font-medium">{p.product_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.variant}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{formatRp(p.price)}</td>
                    <td className="px-4 py-3 font-mono">{p.minimum_order}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(p.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => showHistory(p)} className="p-1.5 hover:bg-secondary rounded"><History size={14} /></button>
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-secondary rounded"><Pencil size={14} /></button>
                        <button onClick={() => setDelId(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Harga Supplier" : "Tambah Harga Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Produk (opsional)</Label>
              <Select value={form.product_id || ""} onValueChange={(v) => { const p = products.find((x) => x.id === v); setForm({ ...form, product_id: v, product_name: p?.name || form.product_name, variant: p?.variant || form.variant }); }}>
                <SelectTrigger><SelectValue placeholder="Pilih produk terdaftar" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.variant}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama Produk</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
              <div><Label>Varian</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Harga Modal</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="price-form-price" /></div>
              <div><Label>Minimum Order</Label><Input type="number" value={form.minimum_order} onChange={(e) => setForm({ ...form, minimum_order: e.target.value })} /></div>
            </div>
            <div><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={submit} data-testid="price-form-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hist} onOpenChange={(v) => !v && setHist(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Riwayat Harga — {hist?.price.product_name} {hist?.price.variant}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {hist?.history.length === 0 && <div className="text-sm text-muted-foreground">Belum ada perubahan harga.</div>}
            {hist?.history.map((h) => (
              <div key={h.id} className="flex justify-between text-sm border border-border rounded-lg p-3">
                <div>
                  <div className="font-mono">{formatRp(h.old_price)} → <span className="font-semibold text-primary">{formatRp(h.new_price)}</span></div>
                  <div className="text-xs text-muted-foreground">{h.changed_by}</div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(h.changed_at)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus harga?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
