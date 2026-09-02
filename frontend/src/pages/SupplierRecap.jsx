import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../lib/api";
import { formatDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ClipboardList, Printer, Download, Package, FileText, FileType } from "lucide-react";
import { toast } from "sonner";

const RANGES = {
  today: { label: "Hari Ini", compute: () => { const s = new Date(); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  yesterday: { label: "Kemarin", compute: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); return { start: s.toISOString(), end: e.toISOString() }; } },
  week: { label: "7 Hari Terakhir", compute: () => { const s = new Date(); s.setDate(s.getDate()-7); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  month: { label: "Bulan Ini", compute: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  last_month: { label: "Bulan Lalu", compute: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59); return { start: s.toISOString(), end: e.toISOString() }; } },
  custom: { label: "Custom", compute: () => ({}) },
};

function rangeLabelStatic(range, customStart, customEnd) {
  if (range === "custom") {
    if (!customStart && !customEnd) return "Semua Waktu";
    return `${customStart ? formatDate(customStart) : "Awal"} - ${customEnd ? formatDate(customEnd) : "Sekarang"}`;
  }
  return RANGES[range].label;
}

export default function SupplierRecap() {
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
  const [buyerData, setBuyerData] = useState(null);
  const [storeName, setStoreName] = useState("");
  const previewRef = useRef(null);

  const activeRange = useMemo(() => {
    if (range === "custom") {
      return {
        start: customStart ? new Date(customStart).toISOString() : undefined,
        end: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined,
      };
    }
    return RANGES[range].compute();
  }, [range, customStart, customEnd]);

  useEffect(() => {
    api.get("/settings").then((r) => setStoreName(r.data?.store_name || ""));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeRange.start) params.set("start_date", activeRange.start);
    if (activeRange.end) params.set("end_date", activeRange.end);
    api.get(`/reports/supplier-recap?${params.toString()}`).then((r) => setData(r.data));
    api.get(`/reports/buyer-recap?${params.toString()}`).then((r) => setBuyerData(r.data));
  }, [activeRange.start, activeRange.end]);

  const exportImage = async (type = "png") => {
    if (!previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const mime = type === "jpg" ? "image/jpeg" : "image/png";
      const link = document.createElement("a");
      link.download = `rekap-supplier-${new Date().toISOString().slice(0,10)}.${type}`;
      link.href = canvas.toDataURL(mime, 0.95);
      link.click();
      toast.success(`Rekap diunduh (${type.toUpperCase()})`);
    } catch (e) {
      toast.error("Gagal menyimpan gambar");
    }
  };

  const handlePrint = () => {
    document.body.classList.add("printing-a4");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-a4"), 200);
    }, 50);
  };

  const treeText = useMemo(() => {
    if (!buyerData) return "";
    const lines = [];
    lines.push(`REKAP PEMBELI - ${storeName || "Our Project Market"}`);
    lines.push(`Periode: ${rangeLabelStatic(range, customStart, customEnd)}`);
    lines.push(`Total Item: ${buyerData.total_items} pcs | Pembeli: ${buyerData.total_buyers} | Transaksi: ${buyerData.transaction_count}`);
    lines.push("");
    if (buyerData.groups.length === 0) {
      lines.push("(Belum ada transaksi pada periode ini)");
      return lines.join("\n");
    }
    buyerData.groups.forEach((g, gi) => {
      if (gi > 0) lines.push("");
      lines.push(`${g.customer_name}   (${g.transaction_count}x transaksi, ${g.total_quantity} pcs)`);
      g.items.forEach((it, i) => {
        const isLast = i === g.items.length - 1;
        const branch = isLast ? "└──" : "├──";
        const cont = isLast ? "    " : "│   ";
        lines.push(`${branch} ${it.product_name}`);
        lines.push(`${cont}├── Jumlah    : ${it.quantity} pcs`);
        lines.push(`${cont}├── Variant   : ${it.variant || "-"}`);
        lines.push(`${cont}└── Deskripsi : ${it.description || (it.sku ? `SKU ${it.sku}` : "-")}`);
      });
    });
    return lines.join("\n");
  }, [buyerData, range, customStart, customEnd, storeName]);

  const dlName = () => `rekap-supplier-${new Date().toISOString().slice(0,10)}`;

  const exportTxt = () => {
    if (!treeText) return;
    const blob = new Blob([treeText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${dlName()}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Rekap diunduh (TXT)");
  };

  const exportPdf = () => {
    if (!treeText) return;
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      const marginX = 12;
      const marginY = 15;
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
      const wrapped = doc.splitTextToSize(treeText, maxWidth);
      let y = marginY;
      const lineHeight = 4.4;
      wrapped.forEach((line) => {
        if (y > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
        doc.text(line, marginX, y);
        y += lineHeight;
      });
      doc.save(`${dlName()}.pdf`);
      toast.success("Rekap diunduh (PDF)");
    } catch (e) {
      toast.error("Gagal membuat PDF");
    }
  };

  const rangeLabel = () => rangeLabelStatic(range, customStart, customEnd);

  return (
    <div className="space-y-4" data-testid="supplier-recap-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rekap Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Rekap kebutuhan restock untuk dikirim ke supplier — tanpa harga.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportTxt} data-testid="recap-export-txt"><FileText size={15} className="mr-1.5" />TXT</Button>
          <Button variant="outline" onClick={exportPdf} data-testid="recap-export-pdf"><FileType size={15} className="mr-1.5" />PDF</Button>
          <Button variant="outline" onClick={() => exportImage("jpg")} data-testid="recap-export-jpg"><Download size={15} className="mr-1.5" />JPG</Button>
          <Button variant="outline" onClick={() => exportImage("png")} data-testid="recap-export-png"><Download size={15} className="mr-1.5" />PNG</Button>
          <Button onClick={handlePrint} data-testid="recap-print"><Printer size={15} className="mr-1.5" />Cetak</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs">Periode</Label>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger data-testid="recap-range"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {range === "custom" && (
          <>
            <div>
              <Label className="text-xs">Dari</Label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="recap-start" />
            </div>
            <div>
              <Label className="text-xs">Sampai</Label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="recap-end" />
            </div>
          </>
        )}
      </div>

      {!data ? (
        <div className="text-muted-foreground">Memuat...</div>
      ) : (
        <div
          ref={previewRef}
          className="print-area rounded-xl p-5 sm:p-6 space-y-5"
          data-testid="recap-preview"
          style={{ background: "#ffffff", color: "#0f172a", border: "1px solid #e2e8f0" }}
        >
          <div className="pb-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
            <div className="text-xs uppercase tracking-wider" style={{ color: "#64748b" }}>Rekap Kebutuhan Restock</div>
            <h2 className="text-xl font-bold tracking-tight mt-1">{storeName || "Our Project Market"}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: "#64748b" }}>
              <div>Periode: <span className="font-medium" style={{ color: "#0f172a" }}>{rangeLabel()}</span></div>
              <div>Total Item Terjual: <span className="font-medium" style={{ color: "#0f172a" }}>{data.total_items.toLocaleString("id-ID")}</span></div>
              <div>Jumlah Supplier: <span className="font-medium" style={{ color: "#0f172a" }}>{data.total_suppliers}</span></div>
              <div>Transaksi: <span className="font-medium" style={{ color: "#0f172a" }}>{data.transaction_count}</span></div>
            </div>
          </div>

          {data.groups.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={40} style={{ color: "#94a3b8" }} className="mx-auto mb-3" />
              <p style={{ color: "#64748b" }}>Belum ada data transaksi pada periode ini.</p>
            </div>
          ) : (
            data.groups.map((g) => (
              <div key={g.supplier_id} className="space-y-2" data-testid={`recap-group-${g.supplier_id}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-bold tracking-tight">{g.supplier_name}</h3>
                  <div className="text-xs" style={{ color: "#64748b" }}>Total: <span className="font-mono font-semibold" style={{ color: "#0f172a" }}>{g.total_quantity.toLocaleString("id-ID")} pcs</span></div>
                </div>
                <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #e2e8f0" }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: "#f1f5f9" }}>
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium w-10">#</th>
                        <th className="px-3 py-2 font-medium">Nama</th>
                        <th className="px-3 py-2 font-medium">Produk</th>
                        <th className="px-3 py-2 font-medium">Detail Produk</th>
                        <th className="px-3 py-2 font-medium text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((i, idx) => (
                        <tr key={idx} style={{ borderTop: "1px solid #e2e8f0" }}>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: "#64748b" }}>{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{i.product_name}</td>
                          <td className="px-3 py-2">{i.variant || <span style={{ color: "#94a3b8" }}>-</span>}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: "#64748b" }}>{i.description || (i.sku ? `SKU: ${i.sku}` : "-")}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-right">{i.quantity.toLocaleString("id-ID")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <div className="pt-3 text-xs italic text-center" style={{ borderTop: "1px solid #e2e8f0", color: "#64748b" }}>
            Dokumen rekap ini otomatis dihasilkan oleh sistem {storeName || "Our Project Market"} — tanpa mencantumkan harga.
          </div>
        </div>
      )}

      {data && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Format Teks Terstruktur (dikelompokkan per Nama Pembeli)</div>
              <div className="text-xs text-muted-foreground">Preview persis seperti hasil export TXT/PDF.</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportTxt} data-testid="recap-tree-export-txt"><FileText size={14} className="mr-1.5" />Unduh TXT</Button>
              <Button variant="outline" size="sm" onClick={exportPdf} data-testid="recap-tree-export-pdf"><FileType size={14} className="mr-1.5" />Unduh PDF</Button>
            </div>
          </div>
          <pre data-testid="recap-tree-preview" className="text-xs sm:text-sm font-mono bg-secondary/40 border border-border rounded-lg p-3 sm:p-4 overflow-x-auto whitespace-pre leading-relaxed">{treeText}</pre>
        </div>
      )}
    </div>
  );
}
