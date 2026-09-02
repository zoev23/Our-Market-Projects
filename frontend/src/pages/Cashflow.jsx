import { useEffect, useState } from "react";
import api, { formatErr } from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Restock", "Packaging", "Delivery", "Electricity", "Operational", "Marketing", "Other"];

export default function Cashflow() {
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "Restock", description: "", amount: 0 });
  const [delId, setDelId] = useState(null);

  const load = () => {
    api.get("/cashflow/summary").then((r) => setSummary(r.data));
    api.get("/expenses").then((r) => setExpenses(r.data));
    api.get("/transactions?limit=100").then((r) => setTransactions(r.data));
  };
  useEffect(load, []);

  const submit = async () => {
    try { await api.post("/expenses", { ...form, amount: Number(form.amount) }); toast.success("Pengeluaran ditambahkan"); setOpen(false); setForm({ category: "Restock", description: "", amount: 0 }); load(); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
  };
  const doDelete = async () => { try { await api.delete(`/expenses/${delId}`); toast.success("Terhapus"); setDelId(null); load(); } catch (e) { toast.error(formatErr(e.response?.data?.detail)); } };

  return (
    <div className="space-y-4" data-testid="cashflow-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cashflow / Arus Kas</h1>
          <p className="text-sm text-muted-foreground mt-1">Pemasukan otomatis + pengeluaran manual.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="expense-add"><Plus size={16} className="mr-1.5" />Tambah Pengeluaran</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total Pemasukan</span><TrendingUp size={16} className="text-emerald-500" /></div>
            <div className="mt-2 text-xl font-bold font-mono text-emerald-500">{formatRp(summary.total_income)}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total Pengeluaran</span><TrendingDown size={16} className="text-rose-500" /></div>
            <div className="mt-2 text-xl font-bold font-mono text-rose-500">{formatRp(summary.total_expense)}</div>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-5">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Net Cashflow</span><Wallet size={16} className="text-primary" /></div>
            <div className="mt-2 text-xl font-bold font-mono text-primary">{formatRp(summary.net_cashflow)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Pemasukan (Sales)</div>
          <div className="max-h-96 overflow-y-auto">
            {transactions.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Belum ada pemasukan.</div> :
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                  <div><div className="text-sm font-medium">{t.transaction_number}</div><div className="text-xs text-muted-foreground">{formatDate(t.created_at)}</div></div>
                  <div className="font-mono font-semibold text-emerald-500">+{formatRp(t.total_amount)}</div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Pengeluaran</div>
          <div className="max-h-96 overflow-y-auto">
            {expenses.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Belum ada pengeluaran.</div> :
              expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{e.description || e.category}</div>
                    <div className="text-xs text-muted-foreground">{e.category} • {formatDate(e.date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono font-semibold text-rose-500">-{formatRp(e.amount)}</div>
                    <button onClick={() => setDelId(e.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Nominal</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="expense-amount" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={submit} data-testid="expense-save">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus pengeluaran?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
