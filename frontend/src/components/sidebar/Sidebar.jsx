import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Package,
  Wallet,
  Star,
  FolderOpen,
  BarChart2,
  Zap,
  LogOut,
  X,
  Receipt,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/patients", icon: Users, label: "Pacientes" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/procedures", icon: Stethoscope, label: "Procedimentos" },
  { to: "/products", icon: Package, label: "Produtos" },
  { to: "/financeiro", icon: Wallet, label: "Financeiro" },
  { to: "/faturamento", icon: Receipt, label: "Faturamento" },
  { to: "/clube", icon: Star, label: "Clube" },
  { to: "/documents", icon: FolderOpen, label: "Documentos" },
  { to: "/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/automacoes", icon: Zap, label: "Automações" },
];

export default function Sidebar({ open = false, onClose }) {
  const { logout } = useAuth();

  return (
    <aside
      className={[
        "w-64 shrink-0 min-h-screen bg-[#1F4D46] text-white p-6 shadow-xl",
        "fixed lg:static inset-y-0 left-0 z-50 lg:z-auto",
        "overflow-y-auto",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-10">
        <img
          src="/logo.png"
          alt="IasoClin"
          className="h-14 object-contain"
        />
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#285A50] transition"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="space-y-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 transition ${
                isActive
                  ? "text-[#D8CDB9] font-semibold"
                  : "text-white/70 hover:text-[#D8CDB9]"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}

        <button
          onClick={logout}
          className="flex items-center gap-3 text-[#D8CDB9] hover:text-white transition mt-10"
        >
          <LogOut size={20} />
          Sair
        </button>
      </nav>
    </aside>
  );
}
