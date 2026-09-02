import { useEffect, useState } from "react";
import api, { formatErr } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function Settings() {
  const [form, setForm] = useState({ store_name: "", address: "", phone: "", receipt_footer: "" });
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => { api.get("/settings").then((r) => setForm(r.data)); }, []);

  const save = async () => {
    setLoading(true);
    try { await api.put("/settings", form); toast.success("Pengaturan disimpan"); }
    catch (e) { toast.error(formatErr(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Informasi toko dan preferensi tampilan.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold">Informasi Toko</h3>
        <div><Label>Nama Toko</Label><Input value={form.store_name || ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} data-testid="settings-name" /></div>
        <div><Label>Alamat</Label><Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>Telepon</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Footer Struk</Label><Textarea value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} data-testid="settings-footer" /></div>
        <Button onClick={save} disabled={loading} data-testid="settings-save">{loading ? "Menyimpan..." : "Simpan"}</Button>
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
    </div>
  );
}
