import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api, { formatErr } from "../lib/api";
import { formatRp } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { key: "products", label: "Produk", endpoint: "/import/products" },
  { key: "stock", label: "Stok", endpoint: "/import/stock" },
  { key: "expenses", label: "Pengeluaran", endpoint: "/import/expenses" },
];

const TEMPLATES = {
  products: {
    filename: "template-produk.xlsx",
    headers: ["name", "variant", "category_name", "supplier_name", "cost_price", "selling_price", "stock", "minimum_stock", "sku", "description"],
    sample: [
      { name: "Risoles", variant: "Coklat Keju", category_name: "Risoles", supplier_name: "Frozen Food Supplier", cost_price: 20000, selling_price: 26000, stock: 20, minimum_stock: 5, sku: "RIS-COK", description: "" },
      { name: "Dimsum", variant: "Ayam", category_name: "Dimsum", supplier_name: "", cost_price: 15000, selling_price: 20000, stock: 10, minimum_stock: 3, sku: "DIM-AYM", description: "Stok sendiri, tanpa supplier" },
    ],
  },
  stock: {
    filename: "template-stok.xlsx",
    headers: ["product_name", "variant", "quantity", "reason", "notes"],
    sample: [
      { product_name: "Risoles", variant: "Coklat Keju", quantity: 10, reason: "Restock", notes: "Import bulk" },
      { product_name: "Dimsum", variant: "Ayam", quantity: 5, reason: "Restock", notes: "" },
    ],
  },
  expenses: {
    filename: "template-pengeluaran.xlsx",
    headers: ["category", "description", "amount", "date"],
    sample: [
      { category: "Restock", description: "Beli minyak goreng", amount: 250000, date: "2026-02-10" },
      { category: "Operational", description: "Listrik bulanan", amount: 500000, date: "2026-02-01" },
    ],
  },
};

export default function ImportData() {
  const [tab, setTab] = useState("products");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setRows([]); setFileName(""); setResult(null); }, [tab]);

  const template = TEMPLATES[tab];

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(template.sample, { header: template.headers });
    ws["!cols"] = template.headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, template.filename);
    toast.success("Template diunduh");
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (data.length === 0) { toast.error("File kosong"); return; }
      setRows(data);
      toast.success(`${data.length} baris siap di-preview`);
    } catch (err) {
      toast.error("Gagal parse file XLSX");
    }
    e.target.value = "";
  };

  const submit = async () => {
    if (rows.length === 0) { toast.error("Belum ada data"); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const { data } = await api.post(TABS.find((t) => t.key === tab).endpoint, { rows });
      setResult(data);
      const key = data.applied != null ? "applied" : "created";
      toast.success(`${data[key]} baris berhasil disimpan${data.skipped?.length ? `, ${data.skipped.length} dilewati` : ""}`);
      setRows([]); setFileName("");
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Gagal import");
    } finally { setSubmitting(false); }
  };

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const previewCols = useMemo(() => (rows[0] ? Object.keys(rows[0]) : template.headers), [rows, template]);

  return (
    <div className="space-y-4" data-testid="import-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Import bulk Produk, Stok, atau Pengeluaran dari file Excel (.xlsx). Ideal untuk migrasi data awal.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`import-tab-${t.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate} data-testid="import-download-template">
            <Download size={16} className="mr-1.5" />Unduh Template ({tab})
          </Button>
          <div className="relative flex-1">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="absolute inset-0 opacity-0 cursor-pointer"
              data-testid="import-file-input"
            />
            <Button variant="outline" className="w-full pointer-events-none">
              <Upload size={16} className="mr-1.5" />
              {fileName || "Pilih File .xlsx"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong>Kolom wajib:</strong> {template.headers.join(", ")}
          {tab === "products" && ". Kategori & Supplier akan dibuat otomatis jika belum ada."}
          {tab === "stock" && ". Produk dicocokkan by name+variant. Jumlah > 0 menambah stok, < 0 mengurangi."}
          {tab === "expenses" && ". Format tanggal: YYYY-MM-DD atau ISO string."}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">Preview — {rows.length} baris {rows.length > 20 && <span className="text-xs text-muted-foreground">(20 pertama)</span>}</div>
            <Button onClick={submit} disabled={submitting} data-testid="import-submit">
              {submitting ? "Menyimpan..." : `Simpan ${rows.length} Baris`}
            </Button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  {previewCols.map((c) => <th key={c} className="px-3 py-2 text-left font-medium">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    {previewCols.map((c) => (
                      <td key={c} className="px-3 py-2 font-mono">
                        {typeof r[c] === "number" && (c.includes("price") || c.includes("amount")) ? formatRp(r[c]) : String(r[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-testid="import-result">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <div className="text-sm font-semibold">
              {result.applied != null ? `${result.applied} stok diupdate` : `${result.created} baris tersimpan`}
              {result.skipped?.length ? ` — ${result.skipped.length} dilewati` : ""}
            </div>
          </div>
          {result.skipped?.length > 0 && (
            <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold flex items-center gap-1.5 text-amber-600"><AlertCircle size={13} />Baris yang dilewati</div>
              {result.skipped.slice(0, 10).map((s, i) => (
                <div key={i} className="text-xs text-muted-foreground">Baris {s.row}: {s.reason}</div>
              ))}
              {result.skipped.length > 10 && (
                <div className="text-xs text-muted-foreground italic">... dan {result.skipped.length - 10} lainnya</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
