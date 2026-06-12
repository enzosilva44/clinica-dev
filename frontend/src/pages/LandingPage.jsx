import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, Map, FileSignature, MessageSquare, Sparkles,
  BarChart2, Package, Shield, ChevronRight, Check,
  Users, TrendingUp, Clock, Star,
} from "lucide-react";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 56 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-10">
        <line x1="14" y1="7"  x2="42" y2="7"  stroke="#C2A56B" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="28" y1="7"  x2="28" y2="73" stroke="#C2A56B" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="14" y1="73" x2="42" y2="73" stroke="#C2A56B" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M28 32 Q34 24 42 20" stroke="#C2A56B" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M28 32 Q40 14 44 12 Q46 22 38 28 Q34 31 28 32 Z" fill="#C2A56B" opacity="0.85" />
      </svg>
      <span className="text-xl font-bold">
        <span className="text-[#1F4D46]">Iaso</span>
        <span className="text-[#C2A56B]">Clin</span>
      </span>
    </div>
  );
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Agenda Inteligente",
    desc: "Visualização semanal e mensal, confirmação automática e lembretes via WhatsApp para zero faltas.",
    color: "#1F4D46",
  },
  {
    icon: Map,
    title: "Mapa de Procedimentos",
    desc: "Mapeamento facial com referência anatômica, registro de doses por músculo e histórico por sessão.",
    color: "#6F7F73",
  },
  {
    icon: FileSignature,
    title: "Assinatura Eletrônica",
    desc: "Fluxo completo com OTP por e-mail, geolocalização, SHA-256 e certificado de evidências em PDF.",
    color: "#C4895A",
  },
  {
    icon: MessageSquare,
    title: "Automações WhatsApp",
    desc: "Confirmações, lembretes, boas-vindas e aniversários enviados automaticamente via Meta Cloud API.",
    color: "#2E6FA8",
  },
  {
    icon: Sparkles,
    title: "Inteligência Artificial",
    desc: "Resumo clínico do paciente, rascunho de evoluções e análise financeira com insights em tempo real.",
    color: "#7C5CBF",
  },
  {
    icon: BarChart2,
    title: "Relatórios & Analytics",
    desc: "Tickets médios, procedimentos mais realizados, performance mensal e projeções financeiras.",
    color: "#C4895A",
  },
  {
    icon: Package,
    title: "Estoque de Insumos",
    desc: "Controle de produtos, movimentações, alertas de estoque baixo e rastreio de uso por procedimento.",
    color: "#1F4D46",
  },
  {
    icon: Shield,
    title: "Documentos Digitais",
    desc: "Pasta sanitária completa com contratos, termos e anamneses — versionados e auditáveis.",
    color: "#6F7F73",
  },
];

const STATS = [
  { icon: Users,      value: "100%",   label: "Prontuário digital"           },
  { icon: Clock,      value: "−40%",   label: "Tempo em burocracia"          },
  { icon: TrendingUp, value: "+30%",   label: "Retenção de pacientes"        },
  { icon: Star,       value: "8 em 1", label: "Módulos integrados"           },
];

const PLANS = [
  {
    name: "Solo",
    price: "R$ 197",
    period: "/mês",
    desc: "Para profissionais autônomos",
    features: ["1 usuário", "Pacientes ilimitados", "Agenda + Evoluções", "Documentos digitais", "IA básica"],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    name: "Clínica",
    price: "R$ 397",
    period: "/mês",
    desc: "Para clínicas em crescimento",
    features: ["Até 5 usuários", "Tudo do Solo", "WhatsApp Automações", "Assinatura eletrônica", "Analytics avançado", "Estoque completo"],
    cta: "Testar 14 dias grátis",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    desc: "Para redes e franquias",
    features: ["Usuários ilimitados", "Multi-clínica", "Suporte dedicado", "Onboarding personalizado", "SLA garantido"],
    cta: "Falar com comercial",
    highlight: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#E8E0D2]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-[#1F4D46] transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-[#1F4D46] transition">Planos</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/cadastro")}
              className="text-sm text-[#1F4D46] font-medium hover:opacity-70 transition hidden sm:block"
            >
              Entrar
            </button>
            <button
              onClick={() => navigate("/cadastro")}
              className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
            >
              Começar grátis <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bg-[#F5F1EA] pt-20 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-[#1F4D46]/10 text-[#1F4D46] text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles size={12} /> Inteligência Artificial integrada
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-[#1F4D46] leading-tight mb-6">
            A clínica de estética<br />
            <span className="text-[#C2A56B]">que se gerencia sozinha</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Do agendamento à assinatura eletrônica avançada, do mapa facial à análise financeira com IA.
            IasoClin é o sistema completo para clínicas de harmonização facial e estética médica.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/cadastro")}
              className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-8 py-4 rounded-2xl font-bold text-base transition flex items-center gap-2 shadow-lg shadow-[#1F4D46]/20"
            >
              Testar 14 dias grátis <ChevronRight size={16} />
            </button>
            <button
              onClick={() => navigate("/cadastro")}
              className="border-2 border-[#D8CDB9] hover:border-[#1F4D46] text-[#1F4D46] px-8 py-4 rounded-2xl font-semibold text-base transition"
            >
              Ver demonstração
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-[#1F4D46] py-14 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[#C2A56B]/20 flex items-center justify-center mx-auto mb-3">
                <Icon size={18} className="text-[#C2A56B]" />
              </div>
              <p className="text-3xl font-black text-white mb-1">{value}</p>
              <p className="text-[#D8CDB9]/70 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-[#1F4D46] mb-4">
              Tudo que sua clínica precisa,<br />em um só lugar
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              8 módulos integrados que conversam entre si. Sem sistemas paralelos, sem planilhas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-[#F5F1EA] rounded-2xl p-6 hover:shadow-md transition group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: color + "22" }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <h3 className="font-bold text-[#1F4D46] text-sm mb-2">{title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESTAQUE: ASSINATURA ELETRÔNICA ── */}
      <section className="py-20 px-6 bg-[#F5F1EA]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <span className="text-xs font-semibold text-[#C2A56B] uppercase tracking-widest block mb-3">
              Lei 14.063/2020
            </span>
            <h2 className="text-3xl font-black text-[#1F4D46] mb-5 leading-tight">
              Assinatura eletrônica<br />avançada e auditável
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed text-sm">
              Seus documentos assinados com validade jurídica completa.
              OTP por e-mail, captura de geolocalização, hash SHA-256
              e certificado de evidências gerado automaticamente em PDF.
            </p>
            <ul className="space-y-3">
              {[
                "Validação de identidade por código OTP",
                "Assinatura manuscrita digital",
                "Rastreio de IP, dispositivo e localização",
                "Hash SHA-256 do documento original",
                "Certificado de auditoria anexado ao PDF",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-[#1F4D46] flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 bg-[#1F4D46] rounded-3xl p-8 text-white">
            <p className="text-xs font-semibold text-[#C2A56B] uppercase tracking-widest mb-4">
              Certificado de Evidências
            </p>
            {[
              ["Assinante", "Maria da Silva"],
              ["CPF", "•••.456.789-••"],
              ["Data/Hora UTC", "2026-06-08T21:15:34Z"],
              ["OTP validado", "e-mail", true],
              ["Geolocalização", "Registrada", true],
              ["Hash SHA-256", "f2f4db7f6e2a..."],
            ].map(([k, v, checked]) => (
              <div key={k} className="flex justify-between py-2.5 border-b border-white/10 text-xs">
                <span className="text-[#D8CDB9]/60">{k}</span>
                <span className="text-white font-medium inline-flex items-center gap-1">
                  {checked && <Check size={11} className="text-green-400" />}{v}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-[#D8CDB9]/40 mt-4 leading-relaxed">
              Documento assinado eletronicamente em conformidade com a Lei 14.063/2020.
            </p>
          </div>
        </div>
      </section>

      {/* ── DESTAQUE: IA ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1">
            <span className="text-xs font-semibold text-[#C2A56B] uppercase tracking-widest block mb-3">
              Inteligência Artificial
            </span>
            <h2 className="text-3xl font-black text-[#1F4D46] mb-5 leading-tight">
              IA que conhece<br />seu paciente
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed text-sm">
              Cada vez que você entra no prontuário, a IA já analisou o histórico completo —
              procedimentos, evoluções, agendamentos e financeiro — e apresenta um resumo pronto.
            </p>
            <ul className="space-y-3">
              {[
                "Resumo clínico gerado automaticamente",
                "Rascunho de evoluções com um clique",
                "Análise financeira e guardião de saúde fiscal",
                "Sugestões de retorno por paciente",
                "Frase motivacional diária personalizada",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-[#C2A56B] flex items-center justify-center shrink-0">
                    <Sparkles size={10} className="text-white" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 bg-[#F5F1EA] rounded-3xl p-7 border border-[#D8CDB9]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-[#1F4D46]" />
              <span className="text-xs font-semibold text-[#1F4D46] uppercase tracking-wide">Resumo gerado por IA</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed bg-white rounded-xl p-4 border border-[#D8CDB9]">
              "Paciente com 3 sessões de Botox realizadas nos últimos 6 meses.
              Última evolução em 02/06 sem intercorrências. Retorno programado para
              90 dias. Ticket médio de R$ 380. Procedimento mais frequente: frontal (3x)."
            </p>
            <p className="text-[11px] text-gray-400 mt-3 text-right">Gerado em 0.8s · Claude AI</p>
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-24 px-6 bg-[#F5F1EA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-[#1F4D46] mb-4">
              Planos para cada etapa
            </h2>
            <p className="text-gray-400">Comece sozinho, cresça com a sua clínica.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div key={plan.name}
                className={`rounded-3xl p-7 flex flex-col border-2 transition ${
                  plan.highlight
                    ? "bg-[#1F4D46] border-[#1F4D46] shadow-2xl shadow-[#1F4D46]/20 scale-105"
                    : "bg-white border-[#D8CDB9]"
                }`}>
                {plan.highlight && (
                  <span className="text-[10px] font-bold text-[#1F4D46] bg-[#C2A56B] px-3 py-1 rounded-full w-fit mb-4">
                    MAIS POPULAR
                  </span>
                )}
                <p className={`text-lg font-bold mb-1 ${plan.highlight ? "text-white" : "text-[#1F4D46]"}`}>
                  {plan.name}
                </p>
                <p className={`text-xs mb-5 ${plan.highlight ? "text-[#D8CDB9]/70" : "text-gray-400"}`}>
                  {plan.desc}
                </p>
                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-3xl font-black ${plan.highlight ? "text-white" : "text-[#1F4D46]"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm mb-1 ${plan.highlight ? "text-[#D8CDB9]/60" : "text-gray-400"}`}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2.5 text-xs ${plan.highlight ? "text-[#D8CDB9]" : "text-gray-500"}`}>
                      <Check size={13} className={plan.highlight ? "text-[#C2A56B]" : "text-[#1F4D46]"} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/cadastro")}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                    plan.highlight
                      ? "bg-[#C2A56B] hover:bg-[#D4B97A] text-white"
                      : "bg-[#1F4D46] hover:bg-[#285A50] text-white"
                  }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-20 px-6 bg-[#1F4D46]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Sua clínica merece mais<br />do que uma planilha
          </h2>
          <p className="text-[#D8CDB9]/70 mb-10 max-w-xl mx-auto">
            Junte-se a clínicas que já automatizaram sua gestão com o IasoClin.
            14 dias grátis, sem compromisso.
          </p>
          <button
            onClick={() => navigate("/cadastro")}
            className="bg-[#C2A56B] hover:bg-[#D4B97A] text-white px-10 py-4 rounded-2xl font-bold text-base transition shadow-lg"
          >
            Começar agora — grátis por 14 dias
          </button>
          <p className="text-[#D8CDB9]/40 text-xs mt-4">Sem cartão de crédito necessário</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#163D38] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-[#D8CDB9]/40 text-xs text-center">
            © {new Date().getFullYear()} IasoClin · Sistema de Gestão para Clínicas de Estética
          </p>
          <div className="flex gap-4 text-xs text-[#D8CDB9]/40">
            <span className="hover:text-[#D8CDB9] cursor-pointer transition">Privacidade</span>
            <span className="hover:text-[#D8CDB9] cursor-pointer transition">Termos</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
