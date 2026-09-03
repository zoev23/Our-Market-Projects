import { useEffect, useMemo, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, ArrowDownWideNarrow } from "lucide-react";
import { toast } from "sonner";

const EXPENSE_CATS = ["Restock", "Packaging", "Delivery", "Electricity", "Operational", "Marketing", "Other"];
const INCOME_CATS = ["Modal Awal", "Investasi", "Pinjaman", "Refund", "Bonus", "Lainnya"];

export default function Cashflow() {
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expOpen, setExpOpen] = useState(false);
  const [incOpen, setIncOpen] = useState(false);
  const [expForm, setExpForm] = useState({ category: "Restock", description: "", amount: 0 });
  const [incForm, setIncForm] = useState({ category: "Modal Awal", description: "", amount: 0 });
  const [delExp, setDelExp] = useState(null);
  const [delInc, setDelInc] = useState(null);
  const [sort, setSort] = useState("date_desc");

  const load = () => {
    api.get("/cashflow/summary").then((r) => setSummary(r.data));
    api.get("/expenses").then((r) => setExpenses(r.data));
    api.get("/incomes").then((r) => setIncomes(r.data));
    api.get("/transactions?limit=200").then((r) => setTransactions(r.data));
  };
  useEffect(load, []);

  const sortFn = (arr, kind) => {
    const s = [...arr];
    switch (sort) {
      case "date_asc": s.sort((a, b) => (a.date || a.created_at || "").localeCompare(b.date || b.created_at || "")); break;
      case "amount_desc": s.sort((a, b) => (b.amount || b.total_amount || 0) - (a.amount || a.total_amount || 0)); break;
      case "amount_asc": s.sort((a, b) => (a.amount || a.total_amount || 0) - (b.amount || b.total_amount || 0)); break;
      default: s.sort((a, b) => (b.date || b.created_at || "").localeCompare(a.date || a.created_at || ""));
    }
    return s;
  };

  const sortedIncomes = useMemo(() => sortFn(incomes, "inc"), [incomes, sort]);
  const sortedExpenses = useMemo(() => sortFn(expenses, "exp"), [expenses, sort]);
  const sortedSales = useMemo(() => sortFn(transactions, "sales"), [transactions, sort]);

  const submitExp = async () => {
    try { await api.post("/expenses", { ...expForm, amount: Number(expForm.amount) }); toast.success("Pengeluaran ditambahkan"); setExpOpen(false); setExpForm({ category: "Restock", description: "", amount: 0 }); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const submitInc = async () => {
    try { await api.post("/incomes", { ...incForm, amount: Number(incForm.amount) }); toast.success("Pemasukan ditambahkan"); setIncOpen(false); setIncForm({ category: "Modal Awal", description: "", amount: 0 }); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const doDelExp = async () => { try { await api.delete(`/expenses/${delExp}`); toast.success("Terhapus"); setDelExp(null); load(); } catch (e) { toast.error(formatErr(e.response?.data?.detail)); } };
  const doDelInc = async () => { try { await api.delete(`/incomes/${delInc}`); toast.success("Terhapus"); setDelInc(null); load(); } catch (e) { toast.error(formatErr(e.response?.data?.detail)); } };

  return (
    <div className="space-y-4" data-testid="cashflow-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cashflow / Arus Kas</h1>
          <p className="text-sm text-muted-foreground mt-1">Penjualan otomatis + pemasukan/pengeluaran manual.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIncOpen(true)} data-testid="income-add" className="text-emerald-500 border-emerald-500/40"><Plus size={16} className="mr-1.5" />Pemasukan</Button>
          <Button onClick={() => setExpOpen(true)} data-testid="expense-add"><Plus size={16} className="mr-1.5" />Pengeluaran</Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Pemasukan Total</span><TrendingUp size={16} className="text-emerald-500" /></div><div className="mt-2 text-lg font-bold font-mono text-emerald-500">{formatRp(summary.total_income)}</div><div className="text-[10px] text-muted-foreground mt-1">Sales {formatRp(summary.total_income_sales)} + Manual {formatRp(summary.total_income_manual)}</div></div>
          <div className="bg-card border border-border rounded-xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Pemasukan Manual</span><TrendingUp size={16} className="text-emerald-500" /></div><div className="mt-2 text-lg font-bold font-mono">{formatRp(summary.total_income_manual)}</div></div>
          <div className="bg-card border border-border rounded-xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Pengeluaran</span><TrendingDown size={16} className="text-rose-500" /></div><div className="mt-2 text-lg font-bold font-mono text-rose-500">{formatRp(summary.total_expense)}</div></div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Net Cashflow</span><Wallet size={16} className="text-primary" /></div><div className="mt-2 text-lg font-bold font-mono text-primary">{formatRp(summary.net_cashflow)}</div></div>
        </div>
      )}

      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          <ArrowDownWideNarrow size={14} className="text-muted-foreground" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-56" data-testid="cashflow-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Tanggal (terbaru)</SelectItem>
              <SelectItem value="date_asc">Tanggal (terlama)</SelectItem>
              <SelectItem value="amount_desc">Nominal (terbesar)</SelectItem>
              <SelectItem value="amount_asc">Nominal (terkecil)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Pemasukan Manual</div>
          <div className="max-h-96 overflow-y-auto">
            {sortedIncomes.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Belum ada pemasukan manual.</div> :
              sortedIncomes.map((i) => (
                <div key={i.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0" data-testid={`income-row-${i.id}`}>
                  <div><div className="text-sm font-medium">{i.description || i.category}</div><div className="text-xs text-muted-foreground">{i.category} • {formatDate(i.date)}</div></div>
                  <div className="flex items-center gap-2"><div className="font-mono font-semibold text-emerald-500">+{formatRp(i.amount)}</div><button onClick={() => setDelInc(i.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 size={13} /></button></div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Pemasukan Penjualan</div>
          <div className="max-h-96 overflow-y-auto">
            {sortedSales.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Belum ada penjualan.</div> :
              sortedSales.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                  <div><div className="text-sm font-medium">{t.transaction_number}</div><div className="text-xs text-muted-foreground">{formatDate(t.created_at)}</div></div>
                  <div className="font-mono font-semibold text-emerald-500">+{formatRp(t.total_amount)}</div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Pengeluaran</div>
          <div className="max-h-96 overflow-y-auto">
            {sortedExpenses.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Belum ada pengeluaran.</div> :
              sortedExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                  <div><div className="text-sm font-medium">{e.description || e.category}</div><div className="text-xs text-muted-foreground">{e.category} • {formatDate(e.date)}</div></div>
                  <div className="flex items-center gap-2"><div className="font-mono font-semibold text-rose-500">-{formatRp(e.amount)}</div><button onClick={() => setDelExp(e.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 size={13} /></button></div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <Dialog open={incOpen} onOpenChange={setIncOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pemasukan Manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kategori</Label>
              <Select value={incForm.category} onValueChange={(v) => setIncForm({ ...incForm, category: v })}>
                <SelectTrigger data-testid="income-category"><SelectValue /></SelectTrigger>
                <SelectContent>{INCOME_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deskripsi</Label><Textarea value={incForm.description} onChange={(e) => setIncForm({ ...incForm, description: e.target.value })} /></div>
            <div><Label>Nominal</Label><Input type="number" value={incForm.amount} onChange={(e) => setIncForm({ ...incForm, amount: e.target.value })} data-testid="income-amount" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIncOpen(false)}>Batal</Button><Button onClick={submitInc} data-testid="income-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kategori</Label>
              <Select value={expForm.category} onValueChange={(v) => setExpForm({ ...expForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deskripsi</Label><Textarea value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} /></div>
            <div><Label>Nominal</Label><Input type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} data-testid="expense-amount" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExpOpen(false)}>Batal</Button><Button onClick={submitExp} data-testid="expense-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delExp} onOpenChange={(v) => !v && setDelExp(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus pengeluaran?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelExp}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!delInc} onOpenChange={(v) => !v && setDelInc(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus pemasukan?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelInc}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
