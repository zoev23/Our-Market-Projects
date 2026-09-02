import { useEffect, useState } from "react";
import api, { formatErr } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", contact_person: "", phone: "", address: "", notes: "", status: "active" };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = () => { api.get("/suppliers").then((r) => setItems(r.data)); api.get("/products").then((r) => setProducts(r.data)); };
  useEffect(load, []);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...empty, ...s }); setOpen(true); };

  const submit = async () => {
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      toast.success(editing ? "Supplier diupdate" : "Supplier ditambahkan"); setOpen(false); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try { await api.delete(`/suppliers/${delId}`); toast.success("Supplier dihapus"); setDelId(null); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-4" data-testid="suppliers-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Data supplier dan produk yang mereka pasok.</p>
        </div>
        <Button onClick={openAdd} data-testid="supplier-add"><Plus size={16} className="mr-1.5" />Tambah Supplier</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Belum ada supplier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => {
            const linked = products.filter((p) => p.supplier_id === s.id);
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl p-5" data-testid={`supplier-card-${s.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-accent/10 text-accent grid place-items-center"><Users size={20} /></div>
                    <div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">{s.contact_person || "-"}</div></div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-secondary rounded"><Pencil size={14} /></button>
                    <button onClick={() => setDelId(s.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {s.phone && <div className="flex items-center gap-1.5"><Phone size={12} />{s.phone}</div>}
                  {s.address && <div className="flex items-center gap-1.5"><MapPin size={12} />{s.address}</div>}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1.5">Produk ({linked.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {linked.slice(0, 6).map((p) => <span key={p.id} className="text-[10px] bg-secondary px-2 py-0.5 rounded">{p.name} — {p.variant}</span>)}
                    {linked.length > 6 && <span className="text-[10px] text-muted-foreground">+{linked.length - 6} lainnya</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Supplier</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-form-name" /></div>
            <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Alamat</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={submit} data-testid="supplier-form-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus supplier?</AlertDialogTitle><AlertDialogDescription>Data tidak dapat dikembalikan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
