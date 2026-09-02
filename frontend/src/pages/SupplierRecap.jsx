import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import api from "../lib/api";
import { formatDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ClipboardList, Printer, Download, Package } from "lucide-react";
import { toast } from "sonner";

const RANGES = {
  today: { label: "Hari Ini", compute: () => { const s = new Date(); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  yesterday: { label: "Kemarin", compute: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); return { start: s.toISOString(), end: e.toISOString() }; } },
  week: { label: "7 Hari Terakhir", compute: () => { const s = new Date(); s.setDate(s.getDate()-7); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  month: { label: "Bulan Ini", compute: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); return { start: s.toISOString(), end: new Date().toISOString() }; } },
  last_month: { label: "Bulan Lalu", compute: () => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59); return { start: s.toISOString(), end: e.toISOString() }; } },
  custom: { label: "Custom", compute: () => ({}) },
};

export default function SupplierRecap() {
  const [range, setRange] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
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

  const rangeLabel = () => {
    if (range === "custom") {
      if (!customStart && !customEnd) return "Semua Waktu";
      return `${customStart ? formatDate(customStart) : "Awal"} – ${customEnd ? formatDate(customEnd) : "Sekarang"}`;
    }
    return RANGES[range].label;
  };

  return (
    <div className="space-y-4" data-testid="supplier-recap-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rekap Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Rekap kebutuhan restock untuk dikirim ke supplier — tanpa harga.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
