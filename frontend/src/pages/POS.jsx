import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Minus, Trash2, Search, Package, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]); // {product, quantity}
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [discount, setDiscount] = useState(0);
  const [cashReceived, setCashReceived] = useState(0);
  const [payment, setPayment] = useState("Tunai");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTxn, setLastTxn] = useState(null);
  const [settings, setSettings] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter((p) => {
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    if (search && !(`${p.name} ${p.variant}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }), [products, catFilter, search]);

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error("Stok habis"); return; }
    setCart((c) => {
      const found = c.find((x) => x.product.id === p.id);
      if (found) {
        if (found.quantity + 1 > p.stock) { toast.error("Stok tidak cukup"); return c; }
        return c.map((x) => x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...c, { product: p, quantity: 1 }];
    });
  };
  const inc = (id) => setCart((c) => c.map((x) => x.product.id === id ? (x.quantity + 1 <= x.product.stock ? { ...x, quantity: x.quantity + 1 } : x) : x));
  const dec = (id) => setCart((c) => c.map((x) => x.product.id === id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x));
  const remove = (id) => setCart((c) => c.filter((x) => x.product.id !== id));

  const subtotal = cart.reduce((s, x) => s + x.product.selling_price * x.quantity, 0);
  const grand = Math.max(subtotal - (Number(discount) || 0), 0);
  const change = Math.max((Number(cashReceived) || 0) - grand, 0);

  const complete = async () => {
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    if (payment === "Tunai" && Number(cashReceived) < grand) { toast.error("Uang tunai kurang"); return; }
    try {
      const { data } = await api.post("/transactions", {
        items: cart.map((x) => ({ product_id: x.product.id, quantity: x.quantity })),
        discount: Number(discount) || 0,
        payment_method: payment,
        cash_received: Number(cashReceived) || grand,
      });
      setLastTxn(data);
      setShowReceipt(true);
      setCart([]); setDiscount(0); setCashReceived(0); setCartOpen(false);
      load();
      toast.success("Transaksi berhasil");
    } catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };

  const CartPanel = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2"><ShoppingCart size={18} /> Keranjang</div>
        <div className="text-xs text-muted-foreground">{cart.length} item</div>
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
              <div className="text-sm font-mono font-semibold">{formatRp(x.product.selling_price * x.quantity)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-4 space-y-3 bg-card">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatRp(subtotal)}</span></div>
        <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Diskon</span>
          <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-28 h-8 text-right font-mono" data-testid="pos-discount" />
        </div>
        <div className="flex justify-between text-base font-bold"><span>Total</span><span className="font-mono text-primary">{formatRp(grand)}</span></div>
        <div>
          <Label className="text-xs">Metode Pembayaran</Label>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger className="mt-1" data-testid="pos-payment"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Tunai">Tunai</SelectItem><SelectItem value="QRIS">QRIS</SelectItem><SelectItem value="Transfer">Transfer Bank</SelectItem><SelectItem value="Debit">Debit</SelectItem></SelectContent>
          </Select>
        </div>
        {payment === "Tunai" && (
          <>
            <div><Label className="text-xs">Uang Diterima</Label>
              <Input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="mt-1 font-mono" data-testid="pos-cash" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[grand, 50000, 100000, 200000].map((v, i) => (
                <button key={i} onClick={() => setCashReceived(v)} className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/70">{i === 0 ? "Uang Pas" : formatRp(v)}</button>
              ))}
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Kembalian</span><span className="font-mono font-semibold text-emerald-500">{formatRp(change)}</span></div>
          </>
        )}
        <Button onClick={complete} disabled={cart.length === 0} className="w-full h-11" data-testid="pos-complete">Complete Order</Button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6 h-[calc(100vh-6rem)] lg:h-[calc(100vh-3rem)]" data-testid="pos-page">
      <div className="flex flex-col min-h-0">
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
            <button key={p.id} onClick={() => addToCart(p)} data-testid={`pos-product-${p.id}`}
              className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary transition-colors group">
              <div className="aspect-square w-full rounded-lg bg-secondary/50 grid place-items-center mb-2 group-hover:bg-primary/10 transition-colors">
                <Package size={32} className="text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="text-sm font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">{p.variant}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <div className="text-sm font-mono font-bold text-primary">{formatRp(p.selling_price)}</div>
                <div className={`text-[10px] px-1.5 py-0.5 rounded ${p.stock <= 0 ? "bg-destructive/10 text-destructive" : p.stock <= p.minimum_stock ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>Stok {p.stock}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-16">Tidak ada produk.</div>}
        </div>
      </div>
      <aside className="hidden lg:flex bg-card border border-border rounded-xl overflow-hidden"><CartPanel /></aside>

      {/* Mobile floating cart button */}
      <button onClick={() => setCartOpen(true)} className="lg:hidden fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground rounded-full h-14 w-14 shadow-lg grid place-items-center" data-testid="pos-cart-open">
        <ShoppingCart size={22} />
        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full h-5 w-5 grid place-items-center">{cart.length}</span>}
      </button>

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/50" onClick={() => setCartOpen(false)}></div>
          <div className="h-[85vh] bg-card rounded-t-2xl border-t border-border"><CartPanel /></div>
        </div>
      )}

      {/* Receipt dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Struk Transaksi</DialogTitle></DialogHeader>
          {lastTxn && settings && (
            <div className="print-receipt text-xs font-mono bg-white text-black p-4 rounded">
              <div className="text-center border-b border-dashed border-black pb-2">
                <div className="font-bold text-sm">{settings.store_name}</div>
                <div>{settings.address}</div>
                <div>{settings.phone}</div>
              </div>
              <div className="py-2 border-b border-dashed border-black">
                <div>No: {lastTxn.transaction_number}</div>
                <div>Tgl: {formatDateTime(lastTxn.created_at)}</div>
              </div>
              <div className="py-2 border-b border-dashed border-black space-y-1">
                {lastTxn.items.map((i, idx) => (
                  <div key={idx}>
                    <div>{i.product_name} {i.variant && `- ${i.variant}`}</div>
                    <div className="flex justify-between"><span>{i.quantity} x {formatRp(i.price)}</span><span>{formatRp(i.subtotal)}</span></div>
                  </div>
                ))}
              </div>
              <div className="py-2 space-y-0.5">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(lastTxn.subtotal)}</span></div>
                <div className="flex justify-between"><span>Diskon</span><span>{formatRp(lastTxn.discount)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatRp(lastTxn.total_amount)}</span></div>
                <div className="flex justify-between"><span>{lastTxn.payment_method}</span><span>{formatRp(lastTxn.cash_received)}</span></div>
                <div className="flex justify-between"><span>Kembali</span><span>{formatRp(lastTxn.change_amount)}</span></div>
              </div>
              <div className="pt-2 border-t border-dashed border-black text-center">{settings.receipt_footer}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Tutup</Button>
            <Button onClick={() => window.print()} data-testid="print-receipt"><Printer size={16} className="mr-2" />Cetak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
