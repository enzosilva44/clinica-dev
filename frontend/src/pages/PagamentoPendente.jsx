import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, MessageCircle, LogOut, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { LogoMark } from "../components/ui/Logo.jsx";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api.js";

import { whatsappHref as montaWhatsapp } from "../config/contato.js";

// Tela de quem contratou direto (sem trial) e ainda não pagou. A conta existe,
// mas o app só abre quando o Asaas confirmar o pagamento.
//
// Ela se auto-resolve: consulta a assinatura a cada 15s e entra sozinha quando
// o webhook chega. Sem isso o cliente pagaria o PIX e continuaria preso aqui,
// sem entender que bastava recarregar.
export default function PagamentoPendente() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [checando, setChecando] = useState(false);

  const verificar = useCallback(async ({ manual = false } = {}) => {
    if (manual) setChecando(true);
    try {
      const { data } = await api.get("/billing/assinatura");
      if (data?.liberado) {
        updateUser({ ...user, subscriptionStatus: data.subscriptionStatus });
        toast.success("Pagamento confirmado! Bem-vindo(a).");
        navigate("/dashboard");
        return true;
      }
      if (manual) toast("Ainda não identificamos o pagamento.", { icon: "⏳" });
    } catch {
      if (manual) toast.error("Não foi possível verificar agora. Tente de novo.");
    } finally {
      if (manual) setChecando(false);
    }
    return false;
  }, [navigate, updateUser, user]);

  // Enquanto a pessoa estiver nesta tela, checa sozinho a cada 15s.
  useEffect(() => {
    const id = setInterval(() => { verificar(); }, 15_000);
    return () => clearInterval(id);
  }, [verificar]);

  const whatsappHref = montaWhatsapp(
    `Olá! Sou da ${user?.clinicName || user?.name || "minha clínica"} e preciso de ajuda com o pagamento da contratação do Iasoclin.`
  );

  return (
    <div className="min-h-screen bg-creme-50 flex items-center justify-center px-6 font-sans">
      <div className="bg-white border border-creme-100 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <LogoMark variant="color" size={22} />
          <span className="font-bold"><span className="text-verde">Iaso</span><span className="text-ambar">clin</span></span>
        </div>

        <div className="w-14 h-14 rounded-full bg-ambar/10 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={26} className="text-ambar" />
        </div>

        <h1 className="text-2xl font-black text-[#141414] mb-2">Aguardando pagamento</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Sua conta já está criada. Assim que o pagamento for confirmado, o acesso
          é liberado automaticamente — você não precisa fazer mais nada aqui.
        </p>

        <div className="bg-creme-50 border border-creme-200 rounded-xl px-4 py-3 mb-6 text-left">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>PIX e cartão</strong> costumam confirmar em minutos.
            {" "}<strong>Boleto</strong> pode levar até 3 dias úteis.
            {" "}Enviamos o link de pagamento para <strong>{user?.email}</strong>.
          </p>
        </div>

        <button onClick={() => verificar({ manual: true })} disabled={checando}
          className="bg-verde hover:bg-verde-900 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition w-full flex items-center justify-center gap-2">
          {checando
            ? (<><Loader2 size={15} className="animate-spin" /> Verificando…</>)
            : (<><RefreshCw size={15} /> Já paguei, verificar agora</>)}
        </button>

        <div className="flex items-center justify-center gap-4 mt-5">
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer"
              className="text-xs text-verde font-medium hover:opacity-70 transition flex items-center gap-1.5">
              <MessageCircle size={14} /> Falar no WhatsApp
            </a>
          )}
          <button onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1.5">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
