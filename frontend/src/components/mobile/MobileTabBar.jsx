import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Users, DollarSign, MoreHorizontal } from "lucide-react";

// Tab bar inferior do app mobile — fiel ao protótipo Iasoclin Mobile.
// Navega por rotas reais; destaca a aba conforme a URL atual.
const TABS = [
  { label: "Início",     icon: Home,            path: "/dashboard" },
  { label: "Agenda",     icon: Calendar,        path: "/agenda" },
  { label: "Pacientes",  icon: Users,           path: "/patients", match: ["/patients"] },
  { label: "Financeiro", icon: DollarSign,      path: "/financeiro" },
  { label: "Mais",       icon: MoreHorizontal,  path: "/mais" },
];

const ACTIVE = "#A9DEC8";
const INACTIVE = "rgba(255,255,255,.45)";

export default function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] grid grid-cols-5 z-30 bg-[#06251B]"
      style={{ padding: "8px 6px calc(8px + env(safe-area-inset-bottom))" }}
    >
      {TABS.map(({ label, icon: Icon, path, match }) => {
        const active = match
          ? match.some((m) => pathname.startsWith(m))
          : pathname === path;
        const color = active ? ACTIVE : INACTIVE;
        return (
          <button
            key={label}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-[3px] py-1.5 rounded-[10px]"
          >
            <Icon size={21} style={{ color }} />
            <span className="text-[9.5px] font-bold" style={{ color }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
