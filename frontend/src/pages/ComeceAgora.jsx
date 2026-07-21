import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarCheck, DollarSign, ScanFace, Sparkles, MessageSquare,
  ChevronRight, MessageCircle,
} from "lucide-react";
import { LogoMark } from "../components/ui/Logo.jsx";
import LeadCaptureModal from "../components/demo/LeadCaptureModal.jsx";
import { captureLeadOrigin, getLeadOrigin } from "../lib/leadOrigin.js";
import api from "../services/api.js";

// Número comercial de WhatsApp — AINDA NÃO DEFINIDO.
// Preencher a env VITE_WHATSAPP_COMMERCIAL (formato internacional, ex: 5511999998888).
const WHATSAPP_COMMERCIAL = import.meta.env.VITE_WHATSAPP_COMMERCIAL || "";

// Módulos do sistema — textos escritos do zero para a página de captação.
const MODULOS = [
  { icon: Users,         title: "Pacientes",     desc: "Prontuário completo, histórico de atendimentos, fotos de evolução e anamnese digital — tudo num lugar só." },
  { icon: CalendarCheck, title: "Agenda",        desc: "Agendamento com confirmação automática, bloqueios, recorrências e lembretes. Sua semana organizada sem esforço." },
  { icon: DollarSign,    title: "Financeiro",    desc: "Cobranças, recebimentos e fluxo de caixa. Acompanhe faturamento, ticket médio e o que entra de verdade." },
  { icon: ScanFace,      title: "Mapa facial",   desc: "Registre procedimentos ponto a ponto no mapa facial e corporal. Planejamento visual que a paciente entende." },
  { icon: Sparkles,      title: "IA assistente", desc: "Encontra pacientes sumidos, sugere reagendamentos e escreve mensagens personalizadas com um clique." },
  { icon: MessageSquare, title: "WhatsApp",      desc: "Confirmações, lembretes e pós-atendimento automáticos direto no WhatsApp da clínica." },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark variant="color" size={26} />
      <span className="text-lg font-bold">
        <span className="text-verde">Iaso</span><span className="text-ambar">clin</span>
      </span>
    </div>
  );
}

export default function ComeceAgora() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [erro, setErro] = useState("");

  // Captura UTM/origem assim que a página abre.
  useEffect(() => { captureLeadOrigin(); }, []);

  const whatsappHref = WHATSAPP_COMMERCIAL
    ? `https://wa.me/${WHATSAPP_COMMERCIAL}?text=${encodeURIComponent("Olá! Quero saber mais sobre o Iasoclin.")}`
    : null;

  function abrirModal() {
    setErro("");
    setModalOpen(true);
  }

  // Recebe os dados do lead (nome, telefone, e-mail opcional) do modal,
  // cria a conta demo com esses dados e entra no sistema.
  async function iniciarDemo(lead) {
    setErro("");
    setLoadingDemo(true);
    try {
      const origin = getLeadOrigin();
      const { data } = await api.post("/auth/demo", {
        ...lead,
        acquisitionChannel: origin?.acquisitionChannel || null,
        utm: origin?.utm || null,
      });
      // Loga automaticamente na conta demo e entra no sistema.
      if (data?.token) localStorage.setItem("token", data.token);
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));
      // Recarrega para o AuthProvider ler o novo user do localStorage.
      window.location.assign("/dashboard");
    } catch (e) {
      setErro(e?.response?.data?.error || "Não conseguimos abrir a demonstração agora. Tente de novo em instantes.");
      setLoadingDemo(false);
    }
  }

  // Bloco de CTAs reutilizado no topo e no rodapé — sempre visível.
  function renderCTAs(compact = false) {
    return (
      <div className={`flex flex-col sm:flex-row gap-3 ${compact ? "" : "mt-8"}`}>
        <button
          onClick={abrirModal}
          className="bg-verde hover:bg-verde-900 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-verde/15"
        >
          Testar demo grátis <ChevronRight size={16} />
        </button>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="border border-creme-200 text-verde px-6 py-3.5 rounded-xl font-medium text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} /> Falar no WhatsApp
          </a>
        ) : (
          <button
            disabled
            title="Número de WhatsApp comercial ainda não configurado (VITE_WHATSAPP_COMMERCIAL)"
            className="border border-creme-200 text-gray-400 px-6 py-3.5 rounded-xl font-medium text-sm cursor-not-allowed flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} /> Falar no WhatsApp
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-[#1F2D2A]">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-creme-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")}><Logo /></button>
          <button onClick={() => navigate("/login")} className="text-sm text-verde font-medium hover:opacity-70 transition">
            Entrar
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-creme-50 border-b border-creme-100">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-20 text-center">
          <span className="inline-flex items-center gap-2 bg-verde/8 text-verde text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles size={12} /> Teste sem cartão de crédito
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-[#141414] leading-[1.1] mb-5">
            Conheça o sistema<br />
            <span className="italic font-serif text-verde">por dentro, agora.</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mb-2 max-w-xl mx-auto">
            Abra uma demonstração com dados de exemplo e navegue pelo sistema completo — ou fale com a gente no WhatsApp pra uma explicação passo a passo.
          </p>
          <div className="max-w-md mx-auto">{renderCTAs()}</div>
          <p className="text-[11px] text-gray-400 mt-4">A demonstração é temporária: os dados de teste são apagados depois.</p>
        </div>
      </section>

      {/* MÓDULOS */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-ambar uppercase tracking-widest mb-3 text-center">O que você vai ver</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight mb-12 text-center">
          Tudo que a clínica precisa,<br /><span className="italic font-serif">num sistema só.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-10">
          {MODULOS.map(({ icon: Icon, title, desc }) => (
            <div key={title}>
              <div className="w-10 h-10 bg-[#F0F7F5] rounded-xl flex items-center justify-center mb-4">
                <Icon size={18} className="text-verde" />
              </div>
              <h3 className="font-bold text-[#141414] mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-verde rounded-3xl px-8 py-12 md:px-14 md:py-14 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
              Pronta pra ver de perto?
            </h2>
            <p className="text-white/60 text-sm max-w-sm mx-auto mb-8">
              Leva menos de um minuto pra entrar na demonstração. Sem compromisso, sem cartão.
            </p>
            <div className="max-w-md mx-auto [&_button]:bg-white [&_button]:text-verde [&_a]:border-white/30 [&_a]:text-white">
              {renderCTAs(true)}
            </div>
          </div>
          <div className="absolute -right-10 -bottom-16 w-72 h-72 rounded-full bg-white/5" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-creme-100">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-gray-300">© 2026 iasoclin · França, SP</p>
        </div>
      </footer>

      <LeadCaptureModal
        open={modalOpen}
        loading={loadingDemo}
        erro={erro}
        onClose={() => !loadingDemo && setModalOpen(false)}
        onSubmit={iniciarDemo}
      />
    </div>
  );
}
