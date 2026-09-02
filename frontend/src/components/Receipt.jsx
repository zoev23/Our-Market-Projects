import { useRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "./ui/button";
import { Printer, Download } from "lucide-react";
import { formatRp, formatDateTime } from "../lib/format";
import { toast } from "sonner";

// Thermal receipt (80mm ≈ 302px @ 96dpi). Renders on-screen exactly at the print width
// so the preview, print output, and image export all match.
export default function Receipt({ txn, settings, onClose, showCloseButton = false }) {
  const ref = useRef(null);

  if (!txn || !settings) return null;

  const exportImage = async (type = "png") => {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#ffffff",
        scale: 2, // higher resolution
        useCORS: true,
      });
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

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="max-h-[60vh] overflow-y-auto w-full flex justify-center">
        <div
          ref={ref}
          className="print-receipt font-mono bg-white text-black"
          data-testid="receipt-preview"
          style={{
            width: "302px",
            padding: "12px",
            fontSize: "11px",
            lineHeight: 1.4,
            boxSizing: "border-box",
          }}
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
    </div>
  );
}
