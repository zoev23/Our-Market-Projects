import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Plus, Minus, Trash2, Search, Package, ShoppingCart, StickyNote, Info, Truck, Store } from "lucide-react";
import { toast } from "sonner";
import Receipt from "../components/Receipt";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]); // {product, quantity, note}
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [source, setSource] = useState("supplier"); // supplier | own_stock
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [packing, setPacking] = useState(0);
  const [frying, setFrying] = useState(0);
  const [payment, setPayment] = useState("QRIS");
  const [customerName, setCustomerName] = useState("");
  const [txnDate, setTxnDate] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTxn, setLastTxn] = useState(null);
  const [settings, setSettings] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [expandedNote, setExpandedNote] = useState({});

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/settings").then((r) => {
      setSettings(r.data);
      setShipping(Number(r.data?.default_shipping_fee || 0));
      setPacking(Number(r.data?.default_packing_fee || 0));
      setFrying(Number(r.data?.default_frying_fee || 0));
    });
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter((p) => {
    const isSupplier = !!p.supplier_id;
    if (source === "supplier" && !isSupplier) return false;
    if (source === "own_stock" && isSupplier) return false;
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    if (search && !(`${p.name} ${p.variant}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }), [products, source, catFilter, search]);

  const switchSource = (v) => {
    if (v === source) return;
    if (cart.length > 0) {
      if (!window.confirm("Ganti mode akan mengosongkan keranjang. Lanjutkan?")) return;
      setCart([]);
    }
    setSource(v);
  };

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error("Stok habis"); return; }
    const isSupplier = !!p.supplier_id;
    const productSource = isSupplier ? "supplier" : "own_stock";
    if (productSource !== source) {
      toast.error("Produk beda mode. Ganti tab dulu.");
      return;
    }
    setCart((c) => {
      const found = c.find((x) => x.product.id === p.id);
      if (found) {
        if (found.quantity + 1 > p.stock) { toast.error("Stok tidak cukup"); return c; }
        return c.map((x) => x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...c, { product: p, quantity: 1, note: "" }];
    });
  };
  const inc = (id) => setCart((c) => c.map((x) => x.product.id === id ? (x.quantity + 1 <= x.product.stock ? { ...x, quantity: x.quantity + 1 } : x) : x));
  const dec = (id) => setCart((c) => c.map((x) => x.product.id === id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x));
  const remove = (id) => setCart((c) => c.filter((x) => x.product.id !== id));
  const setNote = (id, note) => setCart((c) => c.map((x) => x.product.id === id ? { ...x, note } : x));
  const toggleNote = (id) => setExpandedNote((e) => ({ ...e, [id]: !e[id] }));

  const subtotal = cart.reduce((s, x) => s + x.product.selling_price * x.quantity, 0);
  const feesTotal = (Number(shipping) || 0) + (Number(packing) || 0) + (Number(frying) || 0);
  const grand = Math.max(subtotal + feesTotal - (Number(discount) || 0), 0);

  const complete = async () => {
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    try {
      const { data } = await api.post("/transactions", {
        items: cart.map((x) => ({ product_id: x.product.id, quantity: x.quantity, note: x.note || "" })),
        discount: Number(discount) || 0,
        shipping_fee: Number(shipping) || 0,
        packing_fee: Number(packing) || 0,
        frying_fee: Number(frying) || 0,
        payment_method: payment,
        cash_received: grand,
        customer_name: customerName.trim(),
        transaction_date: txnDate ? new Date(txnDate).toISOString() : null,
      });
      setLastTxn(data);
      setShowReceipt(true);
      setCart([]); setDiscount(0); setCustomerName(""); setTxnDate(""); setCartOpen(false);
      setShipping(Number(settings?.default_shipping_fee || 0));
      setPacking(Number(settings?.default_packing_fee || 0));
      setFrying(Number(settings?.default_frying_fee || 0));
      load();
      toast.success("Transaksi berhasil");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const sourceBadge = source === "supplier"
    ? { label: "Titipan Supplier", cls: "bg-amber-500/10 text-amber-600 border-amber-500/40" }
    : { label: "Stok Sendiri", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/40" };

  const cartPanel = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2"><ShoppingCart size={18} /> Keranjang</div>
        <div className={`text-[10px] px-2 py-0.5 rounded-full border ${sourceBadge.cls}`} data-testid="cart-source-badge">{sourceBadge.label}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {cart.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Keranjang masih kosong.</div>}
        {cart.map((x) => (
          <div key={x.product.id} className="bg-secondary/50 border border-border rounded-lg p-3" data-testid={`cart-item-${x.product.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{x.product.name}</div>
                <div className="text-xs text-muted-foreground truncate">{x.product.variant}</div>
              </div>
              <button onClick={() => remove(x.product.id)} className="text-destructive hover:opacity-70" data-testid={`cart-remove-${x.product.id}`}><Trash2 size={14} /></button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => dec(x.product.id)}><Minus size={13} /></Button>
                <span className="text-sm font-semibold w-6 text-center">{x.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => inc(x.product.id)}><Plus size={13} /></Button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleNote(x.product.id)}
                  className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${x.note ? "text-primary" : "text-muted-foreground"}`}
                  title="Tambah catatan"
                  data-testid={`cart-note-toggle-${x.product.id}`}
                >
                  <StickyNote size={14} />
                </button>
                <div className="text-sm font-mono font-semibold">{formatRp(x.product.selling_price * x.quantity)}</div>
              </div>
            </div>
            {(expandedNote[x.product.id] || x.note) && (
              <Textarea
                value={x.note || ""}
                onChange={(e) => setNote(x.product.id, e.target.value)}
                placeholder="Catatan produk..."
                rows={2}
                className="mt-2 text-xs resize-none"
                data-testid={`cart-note-${x.product.id}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-border p-4 space-y-3 bg-card">
        <div>
          <Label className="text-xs">Nama Pembeli</Label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Contoh: Septi (opsional)"
            className="mt-1"
            data-testid="pos-customer-name"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Tanggal Transaksi</Label>
            {txnDate && (
              <button
                type="button"
                onClick={() => setTxnDate("")}
                className="text-[10px] text-muted-foreground hover:text-foreground"
                data-testid="pos-txn-date-clear"
              >
                Reset ke sekarang
              </button>
            )}
          </div>
          <Input
            type="datetime-local"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
            className="mt-1"
            data-testid="pos-txn-date"
          />
        </div>

        <div className="space-y-1.5 pt-1 border-t border-border">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Biaya Tambahan</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Ongkir</Label>
              <Input type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} className="h-8 text-xs font-mono" data-testid="pos-fee-shipping" />
            </div>
            <div>
              <Label className="text-[10px]">Packing</Label>
              <Input type="number" value={packing} onChange={(e) => setPacking(e.target.value)} className="h-8 text-xs font-mono" data-testid="pos-fee-packing" />
            </div>
            <div>
              <Label className="text-[10px]">Goreng</Label>
              <Input type="number" value={frying} onChange={(e) => setFrying(e.target.value)} className="h-8 text-xs font-mono" data-testid="pos-fee-frying" />
            </div>
          </div>
        </div>

        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatRp(subtotal)}</span></div>
        {feesTotal > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground"><span>Biaya Tambahan</span><span className="font-mono">+{formatRp(feesTotal)}</span></div>
        )}
        <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Diskon</span>
          <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-28 h-8 text-right font-mono" data-testid="pos-discount" />
        </div>
        <div className="flex justify-between text-base font-bold"><span>Total</span><span className="font-mono text-primary" data-testid="pos-total">{formatRp(grand)}</span></div>
        <div>
          <Label className="text-xs">Metode Pembayaran</Label>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger className="mt-1" data-testid="pos-payment"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="QRIS">QRIS</SelectItem>
              <SelectItem value="Transfer">Transfer Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={complete} disabled={cart.length === 0} className="w-full h-11" data-testid="pos-complete">Complete Order</Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6 h-[calc(100vh-6rem)] lg:h-[calc(100vh-3rem)]" data-testid="pos-page">
      <div className="flex flex-col min-h-0">
        <div className="mb-3 flex items-center gap-2 bg-card border border-border rounded-lg p-1 w-full sm:w-fit">
          <button
            onClick={() => switchSource("supplier")}
            className={`flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${source === "supplier" ? "bg-amber-500 text-white" : "hover:bg-secondary text-muted-foreground"}`}
            data-testid="pos-tab-supplier"
          >
            <Truck size={14} /> Titipan Supplier
          </button>
          <button
            onClick={() => switchSource("own_stock")}
            className={`flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${source === "own_stock" ? "bg-emerald-500 text-white" : "hover:bg-secondary text-muted-foreground"}`}
            data-testid="pos-tab-own"
          >
            <Store size={14} /> Stok Sendiri
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..." className="pl-9" data-testid="pos-search" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="sm:w-56" data-testid="pos-cat-filter"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex flex-col hover:border-primary transition-colors group relative">
              <button onClick={() => addToCart(p)} data-testid={`pos-product-${p.id}`} className="text-left flex-1 flex flex-col">
                <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                  <Package size={14} className="text-muted-foreground shrink-0" />
                  <span className="truncate">{p.name}</span>
                  {p.description && (
                    <span title={p.description} className="text-muted-foreground/80 shrink-0"><Info size={12} /></span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{p.variant}</div>
                {p.description ? (
                  <div className="text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-2 italic" data-testid={`pos-product-desc-${p.id}`}>{p.description}</div>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm font-mono font-bold text-primary">{formatRp(p.selling_price)}</div>
                  <div className={`text-[10px] px-1.5 py-0.5 rounded ${p.stock <= 0 ? "bg-destructive/10 text-destructive" : p.stock <= p.minimum_stock ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>Stok {p.stock}</div>
                </div>
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-16">
              Tidak ada produk pada mode {source === "supplier" ? "Titipan Supplier" : "Stok Sendiri"}.
            </div>
          )}
        </div>
      </div>
      <aside className="hidden lg:flex bg-card border border-border rounded-xl overflow-hidden">{cartPanel}</aside>

      <button onClick={() => setCartOpen(true)} className="lg:hidden fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground rounded-full h-14 w-14 shadow-lg grid place-items-center" data-testid="pos-cart-open">
        <ShoppingCart size={22} />
        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full h-5 w-5 grid place-items-center">{cart.length}</span>}
      </button>

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/50" onClick={() => setCartOpen(false)}></div>
          <div className="h-[85vh] bg-card rounded-t-2xl border-t border-border">{cartPanel}</div>
        </div>
      )}

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Struk Transaksi</DialogTitle></DialogHeader>
          <Receipt txn={lastTxn} settings={settings} onClose={() => setShowReceipt(false)} showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
