import {
  LayoutDashboard, Users, Calendar, Stethoscope,
  Package, Wallet, Star, FolderOpen, BarChart2,
  Zap, LogOut, X, Receipt, ClipboardList, Images, Layers,
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
    { to: "/sessoes",    icon: Layers,           label: "Sessões",       show: features.clube },
    { to: "/documents",  icon: FolderOpen,       label: "Documentos",    show: features.documents },
    { to: "/portfolio",  icon: Images,           label: "Portfólio",     show: features.portfolio },
    { to: "/anamnese-modelos", icon: ClipboardList, label: "Anamneses",   show: true },
    { to: "/analytics",  icon: BarChart2,        label: "Analytics",     show: features.analytics },
    { to: "/automacoes", icon: Zap,              label: "Automações",    show: features.whatsapp },
  ].filter((item) => item.show);

  const displayName = user?.nickname || user?.name?.split(" ")[0] || "Usuário";
  const initials    = (user?.name ?? "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside
      className={[
        "w-64 shrink-0 min-h-screen bg-verde-950 text-white flex flex-col",
        "fixed lg:static inset-y-0 left-0 z-50 lg:z-auto",
        "transition-transform duration-200 ease-in-out",
        "p-3.5 pb-4.5",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between gap-2.5 px-2 pb-4.5 mb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-verde flex items-center justify-center shrink-0 shadow-lg">
            <LogoMark variant="rev" size={21} />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] leading-none truncate">
              <span className="font-light text-white">iaso</span><span className="font-semibold text-verde-200">clin</span>
            </p>
            <p className="text-white/40 text-[10.5px] font-medium mt-1.5 truncate">
              {[user?.clinicName, user?.city].filter(Boolean).join(" · ") || "Clínica"}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] transition text-[13px] ${
                isActive
                  ? "bg-verde text-white font-bold"
                  : "text-white/60 font-medium hover:bg-white/7 hover:text-white"
              }`}>
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Perfil ── */}
      <div className="mt-3.5 p-3 rounded-xl bg-white/4 border border-white/7 flex items-center gap-2.5">
        <button
          onClick={() => { navigate("/settings"); onClose?.(); }}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
        >
          <div className="w-8.5 h-8.5 rounded-full bg-verde flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-[12.5px] font-semibold whitespace-nowrap truncate">{displayName}</p>
            <p className="text-white/40 text-[10.5px] truncate">{user?.plan ? `Plano ${user.plan}` : "Configurações"}</p>
          </div>
        </button>
        <button onClick={logout} title="Sair"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
