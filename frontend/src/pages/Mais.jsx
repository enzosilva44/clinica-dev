import { useNavigate } from "react-router-dom";
import {
  Send,
  CreditCard,
  Stethoscope,
  Package,
  Award,
  Layers,
  FileText,
  ClipboardCheck,
  Image,
  BarChart3,
  Zap,
  Settings,
} from "lucide-react";

import MainLayout from "../layouts/MainLayout";

// Tela "Mais" (mobile) — menu de atalhos para as telas fora da tab bar.
// Fiel ao protótipo Iasoclin Mobile.

const SHORTCUTS = [
  { label: "Faturamento",    route: "/faturamento",      icon: CreditCard },
  { label: "Procedimentos",  route: "/procedures",       icon: Stethoscope },
  { label: "Produtos",       route: "/products",         icon: Package },
  { label: "Clube",          route: "/clube",            icon: Award },
  { label: "Sessões",        route: "/sessoes",          icon: Layers },
  { label: "Documentos",     route: "/documents",        icon: FileText },
  { label: "Anamneses",      route: "/anamnese-modelos", icon: ClipboardCheck },
  { label: "Portfólio",      route: "/portfolio",        icon: Image },
  { label: "Analytics",      route: "/analytics",        icon: BarChart3 },
  { label: "Automações",     route: "/automacoes",       icon: Zap },
  { label: "Configurações",  route: "/settings",         icon: Settings },
];

export default function Mais() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="flex flex-col h-full bg-[#FAF7F2]">
        <div className="flex-1 overflow-y-auto px-[18px] pt-5 pb-24">
          <h1 className="font-serif font-light text-[26px] text-[#0A3326] m-0 mb-4">Mais</h1>

          {/* Card de destaque — enviar link de pagamento */}
          <button
            onClick={() => navigate("/automacoes")}
            className="w-full text-left bg-[#06251B] rounded-[16px] p-4 mb-4 flex items-center gap-3.5"
          >
            <div
              className="flex-shrink-0 w-[42px] h-[42px] rounded-[12px] flex items-center justify-center"
              style={{ background: "rgba(169,222,200,.15)" }}
            >
              <Send size={20} color="#A9DEC8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14px] text-white">Enviar link de pagamento</div>
              <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,.55)" }}>
                Pix ou cartão, direto no WhatsApp
              </div>
            </div>
            <span className="flex-shrink-0 text-[#A9DEC8] text-lg">→</span>
          </button>

          {/* Grid de atalhos */}
          <div className="grid grid-cols-3 gap-2.5">
            {SHORTCUTS.map(({ label, route, icon: Icon }) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className="bg-white border border-[#ECE2D2] rounded-[14px] px-2 py-3.5 text-center flex flex-col items-center"
              >
                <Icon size={22} color="#00704A" />
                <span className="text-[10.5px] font-bold mt-1.5 text-[#0A3326]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
