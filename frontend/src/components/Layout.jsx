import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Boxes, Users, Receipt, BarChart3, Wallet, Settings, LogOut, Sun, Moon, Menu, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui/button";

const groups = [
  {
    title: "Utama",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
      { to: "/pos", label: "POS / Kasir", icon: ShoppingCart, id: "pos" },
    ],
  },
  {
    title: "Katalog",
    items: [
      { to: "/products", label: "Produk", icon: Package, id: "products" },
      { to: "/inventory", label: "Stok", icon: Boxes, id: "inventory" },
      { to: "/suppliers", label: "Supplier", icon: Users, id: "suppliers" },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { to: "/transactions", label: "Transaksi", icon: Receipt, id: "transactions" },
      { to: "/cashflow", label: "Cashflow", icon: Wallet, id: "cashflow" },
      { to: "/reports", label: "Laporan", icon: BarChart3, id: "reports" },
      { to: "/supplier-recap", label: "Rekap Supplier", icon: ClipboardList, id: "supplier-recap" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { to: "/settings", label: "Pengaturan", icon: Settings, id: "settings" },
    ],
  },
];

const flat = groups.flatMap((g) => g.items);
const bottomMenu = [flat[0], flat[1], flat[2], flat[5], flat[8]]; // Dashboard, POS, Products, Transactions, Reports

export default function Layout() {
  const { logout, user } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => { await logout(); nav("/login"); };

  const SideContent = ({ onClick }) => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold text-lg">B</div>
          <div>
            <div className="text-base font-bold tracking-tight">Our Project Market</div>
            <div className="text-xs text-muted-foreground">Frozen Food POS</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{g.title}</div>
            <div className="space-y-1">
              {g.items.map((m) => (
                <NavLink
                  key={m.id}
                  to={m.to}
                  end={m.to === "/"}
                  onClick={onClick}
                  data-testid={`nav-${m.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                    }`
                  }
                >
                  <m.icon size={18} />
                  <span>{m.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border space-y-1">
        <button onClick={toggle} data-testid="theme-toggle" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-secondary transition-colors">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button onClick={doLogout} data-testid="logout-btn" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        {user && <div className="px-3 pt-2 text-xs text-muted-foreground truncate">{user.email}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card fixed inset-y-0">
        <SideContent />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-card border-r border-border"><SideContent onClick={() => setOpen(false)} /></div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)}></div>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} data-testid="mobile-menu-btn"><Menu size={22} /></Button>
          <div className="font-bold tracking-tight">Our Project Market</div>
          <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle-mobile">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6"><Outlet /></main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border grid grid-cols-5">
          {bottomMenu.map((m) => (
            <NavLink key={m.id} to={m.to} end={m.to === "/"} data-testid={`bottom-nav-${m.id}`}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              <m.icon size={20} />
              <span>{m.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
