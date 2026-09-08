import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Package, ArrowDownWideNarrow } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", variant: "", category_id: "", supplier_id: "", cost_price: 0, selling_price: 0, stock: 0, minimum_stock: 5, sku: "", status: "active", description: "" };

export default function Products() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [sups, setSups] = useState([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const load = () => {
    api.get("/products").then((r) => setItems(r.data));
    api.get("/categories").then((r) => setCats(r.data));
    api.get("/suppliers").then((r) => setSups(r.data));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const list = items.filter((p) => {
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (search && !(`${p.name} ${p.variant} ${p.sku}`.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
    const s = [...list];
    switch (sort) {
      case "name_desc": s.sort((a, b) => (b.name + b.variant).localeCompare(a.name + a.variant)); break;
      case "price_desc": s.sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0)); break;
      case "price_asc": s.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0)); break;
      case "stock_desc": s.sort((a, b) => (b.stock || 0) - (a.stock || 0)); break;
      case "stock_asc": s.sort((a, b) => (a.stock || 0) - (b.stock || 0)); break;
      default: s.sort((a, b) => (a.name + a.variant).localeCompare(b.name + b.variant));
    }
    return s;
  }, [items, catFilter, search, sort]);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...empty, ...p }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price), stock: Number(form.stock), minimum_stock: Number(form.minimum_stock) };
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      toast.success(editing ? "Produk diupdate" : "Produk ditambahkan");
      setOpen(false); load();
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    try {
      setSavingCategory(true);
      const r = await api.post("/categories", { name });

      let created = r.data;
      if (!created?.id) {
        const refreshed = await api.get("/categories");
        setCats(refreshed.data);
        created = refreshed.data.find((c) => c.name?.toLowerCase() === name.toLowerCase());
      } else {
        setCats((prev) => {
          const exists = prev.some((c) => c.id === created.id);
          return exists ? prev : [...prev, created];
        });
      }

      if (created?.id) {
        setForm((prev) => ({ ...prev, category_id: created.id }));
      }

      toast.success("Kategori ditambahkan");
      setNewCategoryName("");
      setCategoryDialogOpen(false);
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Gagal menambah kategori");
    } finally {
      setSavingCategory(false);
    }
  };

  const doDelete = async () => {
    try { await api.delete(`/products/${delId}`); toast.success("Produk dihapus"); setDelId(null); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const profit = Number(form.selling_price) - Number(form.cost_price);
  const margin = form.selling_price > 0 ? (profit / Number(form.selling_price)) * 100 : 0;

  return (
    <div className="space-y-4" data-testid="products-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Produk</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola daftar produk frozen food Anda.</p>
        </div>
        <Button onClick={openAdd} data-testid="product-add"><Plus size={16} className="mr-1.5" />Tambah Produk</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, varian, SKU..." className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Kategori</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <ArrowDownWideNarrow size={14} className="text-muted-foreground" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="sm:w-48" data-testid="product-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Nama A-Z</SelectItem>
              <SelectItem value="name_desc">Nama Z-A</SelectItem>
              <SelectItem value="price_asc">Harga (murah)</SelectItem>
              <SelectItem value="price_desc">Harga (mahal)</SelectItem>
              <SelectItem value="stock_desc">Stok (banyak)</SelectItem>
              <SelectItem value="stock_asc">Stok (sedikit)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Package size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Belum ada produk.</p>
          <Button onClick={openAdd}><Plus size={16} className="mr-1.5" />Tambah Produk Pertama</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const cat = cats.find((c) => c.id === p.category_id);
            const pr = p.selling_price - p.cost_price;
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4" data-testid={`product-card-${p.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary grid place-items-center"><Package size={20} /></div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-secondary rounded" data-testid={`product-edit-${p.id}`}><Pencil size={14} /></button>
                    <button onClick={() => setDelId(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded" data-testid={`product-delete-${p.id}`}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.variant}</div>
                {cat && <div className="text-[10px] mt-1 inline-block px-1.5 py-0.5 bg-secondary rounded">{cat.name}</div>}
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Modal</div><div className="font-mono font-semibold">{formatRp(p.cost_price)}</div></div>
                  <div><div className="text-muted-foreground">Jual</div><div className="font-mono font-semibold text-primary">{formatRp(p.selling_price)}</div></div>
                  <div><div className="text-muted-foreground">Laba</div><div className="font-mono font-semibold text-emerald-500">{formatRp(pr)}</div></div>
                  <div><div className="text-muted-foreground">Stok</div><div className="font-mono font-semibold">{p.stock}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nama Produk</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-form-name" /></div>
            <div className="col-span-2"><Label>Varian</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
            <div><Label>Kategori</Label>
              <Select
                value={form.category_id || ""}
                onValueChange={(v) => {
                  if (v === "__new_category__") {
                    setNewCategoryName("");
                    setCategoryDialogOpen(true);
                    return;
                  }
                  setForm({ ...form, category_id: v });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value="__new_category__">+ Kategori Baru</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Supplier</Label>
              <Select value={form.supplier_id || ""} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Harga Modal</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} data-testid="product-form-cost" /></div>
            <div><Label>Harga Jual</Label><Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} data-testid="product-form-price" /></div>
            <div><Label>Stok</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            <div><Label>Stok Minimum</Label><Input type="number" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} /></div>
            <div className="col-span-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="col-span-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-2 bg-emerald-500/10 rounded-lg p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Estimasi Laba</span><span className="font-mono font-semibold text-emerald-500">{formatRp(profit)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="font-mono font-semibold">{margin.toFixed(1)}%</span></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={submit} data-testid="product-form-save">{editing ? "Simpan" : "Tambah"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kategori Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nama Kategori</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !savingCategory) createCategory();
              }}
              placeholder="Contoh: Frozen Food"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
              disabled={savingCategory}
            >
              Batal
            </Button>
            <Button onClick={createCategory} disabled={savingCategory}>
              {savingCategory ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus produk?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
