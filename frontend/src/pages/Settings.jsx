import { useEffect, useState } from "react";
import api, { formatErr } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, MessageCircle, Info } from "lucide-react";

export default function Settings() {
  const [form, setForm] = useState({ store_name: "", address: "", phone: "", receipt_footer: "", fonnte_api_key: "", fonnte_device: "" });
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    api.get("/settings").then((r) => setForm({ ...form, ...r.data }));
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    setLoading(true);
    try { await api.put("/settings", form); toast.success("Pengaturan disimpan"); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const webhookUrl = (process.env.REACT_APP_BACKEND_URL || "") + "/api/webhook/fonnte";

  return (
    <div className="space-y-4 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Informasi toko, WhatsApp gateway, dan preferensi tampilan.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">Informasi Toko</h3>
        <div><Label>Nama Toko</Label><Input value={form.store_name || ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} data-testid="settings-name" /></div>
        <div><Label>Alamat</Label><Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>Telepon</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Footer Struk</Label><Textarea value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} data-testid="settings-footer" /></div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-emerald-500" />
          <h3 className="font-semibold">Integrasi WhatsApp (Fonnte)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Isi API key Fonnte agar sistem bisa (1) mengirim struk otomatis via WhatsApp, dan (2) menerima order dari pelanggan lewat webhook. Dapatkan API key gratis di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="underline">fonnte.com</a>.
        </p>
        <div>
          <Label>API Key Fonnte</Label>
          <Input
            type="password"
            value={form.fonnte_api_key || ""}
            onChange={(e) => setForm({ ...form, fonnte_api_key: e.target.value })}
            placeholder="Tempel API key dari dashboard Fonnte"
            data-testid="settings-fonnte-key"
          />
        </div>
        <div>
          <Label>Nomor Device WhatsApp (opsional)</Label>
          <Input
            value={form.fonnte_device || ""}
            onChange={(e) => setForm({ ...form, fonnte_device: e.target.value })}
            placeholder="Contoh: 6281234567890"
            data-testid="settings-fonnte-device"
          />
        </div>
        <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Info size={13} />Setup Webhook Fonnte</div>
          <div className="text-xs text-muted-foreground">Di dashboard Fonnte, isi URL webhook berikut agar pesan pelanggan otomatis tercatat sebagai transaksi:</div>
          <div className="text-xs font-mono bg-background border border-border rounded px-2 py-1 break-all" data-testid="settings-webhook-url">{webhookUrl}</div>
          <div className="text-xs text-muted-foreground">Format pesan pelanggan (dipisah koma):</div>
          <pre className="text-xs font-mono bg-background border border-border rounded px-2 py-1 whitespace-pre-wrap">{`NAMA, Produk, Jumlah, Variant, Deskripsi
Contoh:
Budi, Risoles, 2, Coklat Keju, tanpa saus`}</pre>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">Tema</h3>
        <div className="flex gap-2">
          {["light", "dark", "system"].map((t) => (
            <button key={t} onClick={() => setTheme(t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t)}
              className={`flex-1 px-4 py-3 rounded-lg border ${theme === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"} text-sm font-medium capitalize flex items-center justify-center gap-2`}>
              {t === "light" && <Sun size={16} />}{t === "dark" && <Moon size={16} />}{t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading} data-testid="settings-save">{loading ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
      </div>
    </div>
  );
}
