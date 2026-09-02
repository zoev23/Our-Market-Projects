import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import api, { formatErr } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Printer, Download, MessageCircle, ExternalLink } from "lucide-react";
import { formatRp, formatDateTime } from "../lib/format";
import { toast } from "sonner";

function buildWaMessage(txn, settings) {
  const lines = [];
  lines.push(`*${settings.store_name || "Struk"}*`);
  if (settings.address) lines.push(settings.address);
  if (settings.phone) lines.push(`Telp: ${settings.phone}`);
  lines.push("--------------------------------");
  lines.push(`No  : ${txn.transaction_number}`);
  lines.push(`Tgl : ${formatDateTime(txn.created_at)}`);
  if (txn.customer_name) lines.push(`Cust: ${txn.customer_name}`);
  lines.push("--------------------------------");
  txn.items.forEach((i, idx) => {
    lines.push(`${idx + 1}. ${i.product_name}${i.variant ? " - " + i.variant : ""}`);
    lines.push(`   ${i.quantity} x ${formatRp(i.price)} = ${formatRp(i.subtotal)}`);
    if (i.note) lines.push(`   Note: ${i.note}`);
  });
  lines.push("--------------------------------");
  lines.push(`Subtotal : ${formatRp(txn.subtotal)}`);
  if (txn.discount > 0) lines.push(`Diskon   : -${formatRp(txn.discount)}`);
  lines.push(`*TOTAL   : ${formatRp(txn.total_amount)}*`);
  lines.push(`${txn.payment_method}: ${formatRp(txn.cash_received)}`);
  if (txn.change_amount > 0) lines.push(`Kembali  : ${formatRp(txn.change_amount)}`);
  if (settings.receipt_footer) {
    lines.push("--------------------------------");
    lines.push(settings.receipt_footer);
  }
  return lines.join("\n");
}

function normalizePhone(raw) {
  let p = (raw || "").trim().replace(/[\s\-+]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (!p.startsWith("62") && p.startsWith("8")) p = "62" + p;
  return p;
}

export default function Receipt({ txn, settings, onClose, showCloseButton = false }) {
  const ref = useRef(null);
  const [waOpen, setWaOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  if (!txn || !settings) return null;

  const exportImage = async (type = "png") => {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const mime = type === "jpg" ? "image/jpeg" : "image/png";
      const dataUrl = canvas.toDataURL(mime, 0.95);
      const link = document.createElement("a");
      link.download = `struk-${txn.transaction_number}.${type}`;
      link.href = dataUrl;
      link.click();
      toast.success(`Struk berhasil diunduh (${type.toUpperCase()})`);
    } catch (e) {
      toast.error("Gagal menyimpan struk");
    }
  };

  const openWaFallback = (phoneRaw, message) => {
    const p = normalizePhone(phoneRaw);
    const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    toast.info("Membuka WhatsApp — tap Send secara manual");
  };

  const sendWa = async () => {
    const message = buildWaMessage(txn, settings);
    const p = normalizePhone(phone);
    if (!p || p.length < 8) { toast.error("Nomor WhatsApp tidak valid"); return; }
    setSending(true);
    try {
      const { data } = await api.post("/whatsapp/send", { phone: p, message });
      if (data && data.ok) {
        toast.success("Struk terkirim via Fonnte");
        setWaOpen(false);
        setPhone("");
      } else {
        const reason = (data && data.reason) || "Fonnte tidak tersedia";
        toast.warning(`${reason}. Buka WhatsApp manual sebagai gantinya.`);
        openWaFallback(p, message);
        setWaOpen(false);
      }
    } catch (e) {
      const detail = formatErr(e.response?.data?.detail) || "Fonnte tidak tersedia";
      toast.warning(`${detail}. Buka WhatsApp manual sebagai gantinya.`);
      openWaFallback(p, message);
      setWaOpen(false);
    } finally { setSending(false); }
  };

  const openWaOnly = () => {
    setWaOpen(false);
    openWaFallback(phone, buildWaMessage(txn, settings));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="max-h-[60vh] overflow-y-auto w-full flex justify-center">
        <div
          ref={ref}
          className="print-receipt font-mono bg-white text-black"
          data-testid="receipt-preview"
          style={{ width: "302px", padding: "12px", fontSize: "11px", lineHeight: 1.4, boxSizing: "border-box" }}
        >
          <div className="text-center pb-1.5 border-b border-dashed border-black">
            <div className="receipt-store-name font-bold" style={{ fontSize: "13px" }}>{settings.store_name}</div>
            {settings.address && <div style={{ fontSize: "10px" }}>{settings.address}</div>}
            {settings.phone && <div style={{ fontSize: "10px" }}>Telp: {settings.phone}</div>}
          </div>
          <div className="py-1.5 border-b border-dashed border-black" style={{ fontSize: "10px" }}>
            <div className="flex justify-between"><span>No:</span><span>{txn.transaction_number}</span></div>
            <div className="flex justify-between"><span>Tgl:</span><span>{formatDateTime(txn.created_at)}</span></div>
            {txn.customer_name && <div className="flex justify-between"><span>Cust:</span><span>{txn.customer_name}</span></div>}
          </div>
          <div className="py-1.5 border-b border-dashed border-black space-y-1">
            {txn.items.map((i, idx) => (
              <div key={idx}>
                <div style={{ fontSize: "10.5px" }}>{i.product_name}{i.variant ? ` - ${i.variant}` : ""}</div>
                <div className="flex justify-between" style={{ fontSize: "10px" }}>
                  <span>{i.quantity} x {formatRp(i.price)}</span>
                  <span>{formatRp(i.subtotal)}</span>
                </div>
                {i.note && <div style={{ fontSize: "9.5px", paddingLeft: "4px", fontStyle: "italic" }}>* {i.note}</div>}
              </div>
            ))}
          </div>
          <div className="py-1.5 space-y-0.5" style={{ fontSize: "10px" }}>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(txn.subtotal)}</span></div>
            {txn.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatRp(txn.discount)}</span></div>}
            <div className="flex justify-between font-bold" style={{ fontSize: "11px" }}><span>TOTAL</span><span>{formatRp(txn.total_amount)}</span></div>
            <div className="flex justify-between"><span>{txn.payment_method}</span><span>{formatRp(txn.cash_received)}</span></div>
            {txn.change_amount > 0 && <div className="flex justify-between"><span>Kembali</span><span>{formatRp(txn.change_amount)}</span></div>}
          </div>
          {settings.receipt_footer && (
            <div className="pt-1.5 border-t border-dashed border-black text-center" style={{ fontSize: "10px" }}>
              {settings.receipt_footer}
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex flex-wrap gap-2 justify-end">
        {showCloseButton && onClose && (
          <Button variant="outline" onClick={onClose} data-testid="receipt-close">Tutup</Button>
        )}
        <Button variant="outline" onClick={() => setWaOpen(true)} data-testid="receipt-wa" className="text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10">
          <MessageCircle size={15} className="mr-1.5" />WhatsApp
        </Button>
        <Button variant="outline" onClick={() => exportImage("jpg")} data-testid="receipt-export-jpg">
          <Download size={15} className="mr-1.5" />JPG
        </Button>
        <Button variant="outline" onClick={() => exportImage("png")} data-testid="receipt-export-png">
          <Download size={15} className="mr-1.5" />PNG
        </Button>
        <Button onClick={() => window.print()} data-testid="receipt-print">
          <Printer size={15} className="mr-1.5" />Cetak
        </Button>
      </div>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Kirim Struk via WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomor WhatsApp Penerima</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxx atau 62812xxx"
                data-testid="wa-phone"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Otomatis via Fonnte jika API key sudah diatur di Pengaturan. Kalau gagal atau tak ada key, sistem otomatis buka WhatsApp manual.
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={openWaOnly} data-testid="wa-manual"><ExternalLink size={14} className="mr-1.5" />Buka Manual</Button>
            <Button onClick={sendWa} disabled={sending} data-testid="wa-auto-send">{sending ? "Mengirim..." : "Kirim Auto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
