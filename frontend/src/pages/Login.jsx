import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Snowflake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatErr } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("mrseptianno@gmail.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login berhasil");
      nav("/");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Login gagal");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Snowflake size={24} />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">Our Project Market</div>
              <div className="text-xs text-muted-foreground">Frozen Food POS & ERP</div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Masuk ke Akun</h1>
          <p className="text-sm text-muted-foreground mb-6">Kelola penjualan frozen food Anda dengan mudah.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-11">
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Masuk"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">© 2026 Our Project Market • Modern POS untuk bisnis frozen food</p>
      </div>
    </div>
  );
}
