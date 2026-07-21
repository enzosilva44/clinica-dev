import { AlertTriangle, MessageCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const WHATSAPP_COMMERCIAL = import.meta.env.VITE_WHATSAPP_COMMERCIAL || "";

// Barra de aviso exibida durante a carência de 10 dias após o vencimento
// (accessState === "grace"). Alerta que o acesso será bloqueado e oferece o
// WhatsApp para regularizar. Some quando a clínica está em dia.
export default function OverdueBanner() {
  const { user } = useAuth();

  if (user?.accessState !== "grace") return null;

  const dias = user?.graceDaysLeft;
  const prazo = dias > 1 ? `${dias} dias` : dias === 1 ? "1 dia" : "hoje";

  const whatsappHref = WHATSAPP_COMMERCIAL
    ? `https://wa.me/${WHATSAPP_COMMERCIAL}?text=${encodeURIComponent(
        `Olá! Sou da ${user?.clinicName || user?.name || "minha clínica"} e quero regularizar o pagamento do Iasoclin.`
      )}`
    : null;

  return (
    <div className="w-full bg-ambar text-white">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            Pagamento em aberto. Para não perder o acesso, regularize em até <strong>{prazo}</strong>.
          </span>
        </div>
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noreferrer"
            className="bg-white text-ambar px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-creme-50 transition flex items-center gap-1.5">
            <MessageCircle size={14} /> Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
