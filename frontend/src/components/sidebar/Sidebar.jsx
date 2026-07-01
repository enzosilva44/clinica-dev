import {
  LayoutDashboard, Users, Calendar, Stethoscope,
  Package, Wallet, Star, FolderOpen, BarChart2,
  Zap, LogOut, X, Receipt, ClipboardList,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogoMark } from "../ui/Logo.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { useFeatures } from "../../hooks/useFeatures";

export default function Sidebar({ open = false, onClose }) {
  const { logout, user } = useAuth();
  const features         = useFeatures();
  const navigate         = useNavigate();

  const navItems = [
    { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard",     show: true },
    { to: "/patients",   icon: Users,            label: "Pacientes",     show: true },
    { to: "/agenda",     icon: Calendar,         label: "Agenda",        show: true },
    { to: "/procedures", icon: Stethoscope,      label: "Procedimentos", show: true },
    { to: "/products",   icon: Package,          label: "Produtos",      show: features.stock },
    { to: "/financeiro", icon: Wallet,           label: "Financeiro",    show: features.financial },
    { to: "/faturamento",icon: Receipt,          label: "Faturamento",   show: features.faturamento },
    { to: "/clube",      icon: Star,             label: "Clube",         show: features.clube },
    { to: "/documents",  icon: FolderOpen,       label: "Documentos",    show: features.documents },
    { to: "/anamnese-modelos", icon: ClipboardList, label: "Anamneses",   show: true },
    { to: "/analytics",  icon: BarChart2,        label: "Analytics",     show: features.analytics },
    { to: "/automacoes", icon: Zap,              label: "Automações",    show: features.whatsapp },
  ].filter((item) => item.show);

  const displayName = user?.nickname || user?.name?.split(" ")[0] || "Usuário";
  const initials    = (user?.name ?? "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside
      className={[
        "w-64 shrink-0 min-h-screen bg-[#00704A] text-white flex flex-col shadow-xl",
        "fixed lg:static inset-y-0 left-0 z-50 lg:z-auto",
        "transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <LogoMark variant="rev" size={28} />
          <p className="text-xl font-bold tracking-wide">
            <span className="text-white">Iaso</span><span className="text-[#C4895A]">Clin</span>
          </p>
        </div>
        <button onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#0A3326] transition">
          <X size={18} />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-6 py-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-sm ${
                isActive
                  ? "bg-white/10 text-[#E5D8C5] font-semibold"
                  : "text-white/70 hover:bg-white/5 hover:text-[#E5D8C5]"
              }`}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Perfil + Sair ── */}
      <div className="px-4 pb-6 pt-3 border-t border-white/10">
        <button
          onClick={() => { navigate("/settings"); onClose?.(); }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/10 transition group text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-[#C4895A]/30 flex items-center justify-center shrink-0">
            <span className="text-[#C4895A] text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-tight truncate">{displayName}</p>
            <p className="text-white/40 text-[11px] truncate">{user?.clinicName || "Configurações"}</p>
          </div>
        </button>

        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition text-sm mt-1">
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
