import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import SupplierPrices from "./pages/SupplierPrices";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Cashflow from "./pages/Cashflow";
import Settings from "./pages/Settings";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/products" element={<Products />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/supplier-prices" element={<SupplierPrices />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
