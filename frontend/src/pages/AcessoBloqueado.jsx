import { useNavigate } from "react-router-dom";
import { Lock, MessageCircle, LogOut } from "lucide-react";
import { LogoMark } from "../components/ui/Logo.jsx";
import { useAuth } from "../contexts/AuthContext";

const WHATSAPP_COMMERCIAL = import.meta.env.VITE_WHATSAPP_COMMERCIAL || "";

// Tela cheia mostrada quando o acesso foi suspenso por falta de pagamento
// (passados os 10 dias de carência). Caminhos de saída: falar no WhatsApp
// para regularizar, ou sair.
export default function AcessoBloqueado() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const whatsappHref = WHATSAPP_COMMERCIAL
    ? `https://wa.me/${WHATSAPP_COMMERCIAL}?text=${encodeURIComponent(
        `Olá! Sou da ${user?.clinicName || user?.name || "minha clínica"} e preciso de ajuda para regularizar o pagamento do Iasoclin.`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-creme-50 flex items-center justify-center px-6 font-sans">
      <div className="bg-white border border-creme-100 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <LogoMark variant="color" size={22} />
          <span className="font-bold"><span className="text-verde">Iaso</span><span className="text-ambar">clin</span></span>
        </div>

        <div className="w-14 h-14 rounded-full bg-ambar/10 flex items-center justify-center mx-auto mb-4">
          <Lock size={26} className="text-ambar" />
        </div>

        <h1 className="text-2xl font-black text-[#141414] mb-2">Acesso pausado</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Não identificamos o pagamento da sua mensalidade e o prazo de tolerância de 10 dias
          terminou. Assim que regularizar, seu acesso volta na hora — seus dados continuam guardados.
        </p>

        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noreferrer"
            className="bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition w-full flex items-center justify-center gap-2 mb-3">
            <MessageCircle size={16} /> Pedir ajuda no WhatsApp
          </a>
        ) : (
          <div className="bg-creme-100 text-gray-400 px-6 py-3 rounded-xl font-semibold text-sm w-full flex items-center justify-center gap-2 mb-3">
            <MessageCircle size={16} /> Contato comercial em breve
          </div>
        )}

        <button onClick={() => { logout(); navigate("/login"); }}
          className="text-sm text-gray-400 font-medium hover:text-gray-600 transition flex items-center justify-center gap-1.5 w-full">
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );
}
