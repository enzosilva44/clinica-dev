import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, CreditCard, FileSignature, MessageSquare, Sparkles,
  BarChart2, Check, ChevronRight, Star, Quote,
  Target, Compass, Heart,
} from "lucide-react";
import { LogoMark } from "../components/ui/Logo.jsx";

// URL da área administrativa (app separado)
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "https://admin.iasoclin.com.br";

function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark variant={light ? "rev" : "color"} size={26} />
      <span className="text-lg font-bold">
        <span className={light ? "text-white" : "text-[#00704A]"}>Iaso</span>
        <span className="text-[#C4895A]">clin</span>
      </span>
    </div>
  );
}

const FEATURES = [
  { icon: CalendarCheck, title: "Agenda inteligente",  desc: "Agendamento online com confirmação automática por WhatsApp. Bloqueios, recorrências e lembretes sem esforço." },
  { icon: CreditCard,    title: "Cobranças via Asaas", desc: "Link de pagamento, boleto e PIX gerados automaticamente. Receita em dia e a acompanhar tudo no painel." },
  { icon: FileSignature, title: "Anamnese digital",    desc: "Formulários completos com assinatura digital. Conformidade legal, sem impressão, sem papel perdido." },
  { icon: MessageSquare, title: "WhatsApp integrado",  desc: "Mensagens automáticas de confirmação, lembrete e pós-atendimento. Ilimitado em todos os planos." },
  { icon: Sparkles,      title: "IA assistente",       desc: "Identifica pacientes sumidos, sugere reagendamentos e gera mensagens personalizadas com um clique." },
  { icon: BarChart2,     title: "Relatórios claros",   desc: "Faturamento, ticket médio, taxa de confirmação e histórico de pacientes. Dados que fazem sentido." },
];

const PLANS = [
  {
    name: "Solo", price: "R$ 69", period: "/mês", sub: "para 1 profissional",
    features: ["Agenda completa", "WhatsApp ilimitado", "Cobranças via Asaas", "500 créditos de IA / mês", "20 assinaturas digitais / mês", "10 GB de armazenamento"],
    highlight: false,
  },
  {
    name: "Clínica", price: "R$ 119", period: "/mês", sub: "até 3 profissionais",
    features: ["Tudo do Solo", "1.500 créditos de IA / mês", "60 assinaturas digitais / mês", "30 GB de armazenamento", "Relatórios com 12 meses de histórico", "Parcelamento em até 6x"],
    highlight: true,
  },
  {
    name: "Pro", price: "R$ 189", period: "/mês", sub: "até 5 profissionais",
    features: ["Tudo da Clínica", "5.000 créditos de IA / mês", "Assinaturas ilimitadas", "100 GB de armazenamento", "Histórico completo de analytics", "Parcelamento em até 12x"],
    highlight: false,
  },
];

const DEPOIMENTOS = [
  { nome: "Marina Figueiredo", clinica: "Estúdio de Estética · São Paulo", texto: "Antes eu controlava tudo no caderno. Hoje a agenda confirma sozinha e eu recebo por PIX sem nem precisar cobrar ninguém." },
  { nome: "Camila Lopes",      clinica: "Clínica de Harmonização · Curitiba", texto: "A IA me avisou que três pacientes estavam sumidas. Mandei mensagem e duas delas reagendaram no mesmo dia. Isso paga o plano." },
  { nome: "Roberto Pires",     clinica: "Dermato · Belo Horizonte", texto: "Finalmente um sistema que não parece feito para hospital. É simples, bonito e funciona. Minhas clientes adoram o link de pagamento." },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans text-[#1F2D2A]">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
            <a href="#features"    className="hover:text-[#00704A] transition">Funcionalidades</a>
            <a href="#planos"      className="hover:text-[#00704A] transition">Planos</a>
            <a href="#depoimentos" className="hover:text-[#00704A] transition">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={ADMIN_URL} className="hidden sm:block text-sm text-gray-400 font-medium hover:text-[#00704A] transition">Área Admin</a>
            <button onClick={() => navigate("/login")} className="text-sm text-[#00704A] font-medium hover:opacity-70 transition">Entrar</button>
            <button onClick={() => navigate("/cadastro")} className="bg-[#00704A] hover:bg-[#0A3326] text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
              Começar grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bg-[#FAF7F2] border-b border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#00704A]/8 text-[#00704A] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Sparkles size={12} /> Novo · Agenda com IA integrada
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-[#141414] leading-[1.1] mb-5">
              Sua clínica<br />organizada do<br />
              <span className="italic font-serif text-[#00704A]">jeito certo.</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-md">
              Agenda, cobranças, anamnese e WhatsApp em um só lugar. A gente cuida da rotina com você — pra sua clínica crescer com previsibilidade, no controle.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate("/cadastro")}
                className="bg-[#00704A] hover:bg-[#0A3326] text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#00704A]/15">
                Teste grátis por 14 dias <ChevronRight size={16} />
              </button>
              <button onClick={() => navigate("/login")}
                className="border border-[#E5D8C5] text-[#00704A] px-6 py-3.5 rounded-xl font-medium text-sm hover:bg-white transition">
                Ver demonstração →
              </button>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <div className="flex -space-x-2">
                {["#00704A", "#C4895A", "#6F7F73", "#2E6FA8"].map((c) => (
                  <div key={c} className="w-7 h-7 rounded-full border-2 border-[#FAF7F2]" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-[#C4895A]">
                  {[...Array(5)].map((_, i) => <Star key={i} size={11} fill="#C4895A" />)}
                </div>
                <p className="text-[11px] text-gray-400">+200 clínicas com a gente por perto · sem fidelidade</p>
              </div>
            </div>
          </div>

          {/* Mockup do dashboard */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-[#EFE7DA] overflow-hidden">
              <div className="bg-[#00704A] px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-white/80 text-xs font-medium ml-2">iasoclin</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-3">Bom dia, <span className="font-semibold text-[#00704A]">Ana Flávia</span></p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { v: "8",      l: "hoje",     c: "#00704A" },
                    { v: "R$ 9,2k",l: "+28% mês", c: "#C4895A" },
                    { v: "14",     l: "retornos", c: "#2E6FA8" },
                  ].map((k) => (
                    <div key={k.l} className="bg-[#FAF7F2] rounded-xl p-2.5">
                      <p className="text-lg font-black" style={{ color: k.c }}>{k.v}</p>
                      <p className="text-[9px] text-gray-400">{k.l}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    { h: "09:30", n: "Inês Rocha",    s: "Confirmado", c: "bg-green-100 text-green-700" },
                    { h: "10:15", n: "Sandra Alves",  s: "Próximo",    c: "bg-blue-100 text-blue-700" },
                    { h: "11:00", n: "Rafaela Santos",s: "Pendente",   c: "bg-amber-100 text-amber-700" },
                  ].map((a) => (
                    <div key={a.n} className="flex items-center justify-between bg-[#FAFAF9] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#141414]">{a.h}</span>
                        <span className="text-[11px] text-gray-600">{a.n}</span>
                      </div>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${a.c}`}>{a.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#C4895A] uppercase tracking-widest mb-3">Funcionalidades</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight mb-3">
          Tudo que sua clínica precisa,<br />
          <span className="italic font-serif">sem o que não precisa.</span>
        </h2>
        <p className="text-gray-500 mb-12 max-w-lg">
          Oito módulos integrados num só sistema — pra você tocar a clínica no controle, sem planilha e sem achismo.
        </p>
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-10">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title}>
              <div className="w-10 h-10 bg-[#F0F7F5] rounded-xl flex items-center justify-center mb-4">
                <Icon size={18} className="text-[#00704A]" />
              </div>
              <h3 className="font-bold text-[#141414] mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── POR DENTRO DO SISTEMA ── */}
      <section className="bg-[#FAF7F2] border-y border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-xs font-semibold text-[#C4895A] uppercase tracking-widest mb-3">Por dentro do sistema</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight mb-12">
            Números que<br /><span className="italic font-serif">falam por si.</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Gráfico faturamento */}
            <div className="bg-white border border-[#EFE7DA] rounded-2xl p-6">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Faturamento mensal</p>
              <p className="font-bold text-[#141414] mb-1">Acompanhe o crescimento da clínica em tempo real.</p>
              <p className="text-xs text-gray-400 mb-6">Cada procedimento registrado vira dado. Cada dado vira decisão.</p>
              <div className="flex items-end gap-2 h-28">
                {[35, 45, 40, 60, 55, 80, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, backgroundColor: i >= 5 ? "#00704A" : i >= 3 ? "#6F9B8E" : "#CDDFD8" }} />
                ))}
              </div>
            </div>
            {/* Cards à direita */}
            <div className="space-y-6">
              <div className="bg-[#00704A] rounded-2xl p-6 text-white">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-2">Taxa de confirmação</p>
                <p className="text-5xl font-black mb-2">87%</p>
                <p className="text-sm text-white/70">dos agendamentos confirmados automaticamente via WhatsApp.</p>
              </div>
              <div className="bg-white border border-[#EFE7DA] rounded-2xl p-6">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={13} className="text-[#C4895A]" />
                  <span className="text-[10px] font-semibold text-[#C4895A] uppercase tracking-wide">IA iasoclin</span>
                </div>
                <p className="font-bold text-[#141414] mb-1">Pacientes que somem, a IA encontra.</p>
                <p className="text-sm text-gray-500">Detecção automática de pacientes sem retorno com sugestão de mensagem personalizada.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-[#C4895A] uppercase tracking-widest mb-3">Planos</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#141414] mb-2">Simples assim.</h2>
          <p className="text-gray-500">Todos os recursos em todos os planos. Você escolhe pelo tamanho da sua clínica — a gente cresce junto.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name}
              className={`rounded-2xl border p-6 relative ${plan.highlight ? "border-[#00704A] shadow-xl shadow-[#00704A]/10 bg-white" : "border-[#EFE7DA] bg-white"}`}>
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00704A] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Mais escolhido
                </span>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-black text-[#00704A]">{plan.price}</span>
                <span className="text-sm text-gray-400">{plan.period}</span>
              </div>
              <p className="text-xs text-gray-400 mb-5">{plan.sub}</p>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={15} className="text-[#00704A] shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate("/cadastro")}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
                  plan.highlight ? "bg-[#00704A] hover:bg-[#0A3326] text-white" : "border border-[#E5D8C5] text-[#00704A] hover:bg-[#FAF7F2]"
                }`}>
                Começar grátis
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO SURGIU ── */}
      <section className="bg-[#FAF7F2] border-y border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight mb-5">
              Uma reclamação que<br /><span className="italic font-serif">virou sistema.</span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-3">
              O iasoclin nasceu de tanto ouvir reclamações de uma cunhada biomédica sobre a falta de governança da sua clínica — um sistema engessado, sem controle, sem visibilidade.
            </p>
            <p className="text-gray-500 leading-relaxed">
              Percebi que o problema não era dela: era de centenas de clínicas de estética no Brasil inteiro. Então decidimos construir o que faltava.
            </p>
            <p className="text-xs text-gray-400 mt-4">França, SP · 2025</p>
          </div>
          <div className="bg-white border border-[#EFE7DA] rounded-2xl p-6">
            <Quote size={24} className="text-[#C4895A] mb-3" />
            <p className="text-[#141414] leading-relaxed mb-4 italic font-serif">
              "Minha cunhada biomédica não conseguia ter controle de nada na clínica dela. Sem agenda, sem cobrança, sem histórico. Aquilo me incomodava — e não saía mais da minha cabeça."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#00704A] text-white text-xs font-bold flex items-center justify-center">EO</div>
              <div>
                <p className="text-sm font-bold text-[#141414]">Enzo Oliveira</p>
                <p className="text-xs text-gray-400">Co-fundador & CTO</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TIME FUNDADOR ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-[#C4895A] uppercase tracking-widest mb-3">Time fundador</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#141414] mb-10">Quem está por trás.</h2>
        <div className="bg-white border border-[#EFE7DA] rounded-2xl p-6 flex flex-col md:flex-row gap-6 mb-12">
          <div className="w-full md:w-44 h-36 bg-[#00704A] rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-3xl font-black text-white/90">EO</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-[#141414] text-lg">Enzo Oliveira</p>
            <p className="text-[10px] font-semibold text-[#C4895A] uppercase tracking-wide mb-3">Tecnologia & Produto</p>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">
              Engenheiro de software e AWS Partner com experiência em infraestrutura cloud, FinOps e produtos SaaS. No iasoclin, cuida de toda a arquitetura técnica, produto e estratégia de plataforma.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["AWS", "Backend", "FinOps", "Produto"].map((t) => (
                <span key={t} className="text-[10px] font-medium bg-[#FAF7F2] text-gray-500 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Compass, t: "Visão",   d: "Ser a plataforma de gestão mais usada por clínicas de estética no Brasil." },
            { icon: Target,  t: "Missão",  d: "Dar governança real a clínicas que merecem crescer sem depender de planilha ou caderno." },
            { icon: Heart,   t: "Valores", d: "Simplicidade antes de sofisticação. Transparência com o parceiro. Tecnologia que cuida de quem cuida." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon size={18} className="text-[#00704A] mb-2" />
              <p className="font-bold text-[#141414] mb-1">{t}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section id="depoimentos" className="bg-[#FAF7F2] border-y border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-black text-[#141414] mb-10">Quem usa, recomenda.</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {DEPOIMENTOS.map((d) => (
              <div key={d.nome} className="bg-white border border-[#EFE7DA] rounded-2xl p-6">
                <div className="flex items-center gap-0.5 text-[#C4895A] mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} fill="#C4895A" />)}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">"{d.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00704A] text-white text-[10px] font-bold flex items-center justify-center">
                    {d.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#141414]">{d.nome}</p>
                    <p className="text-[10px] text-gray-400">{d.clinica}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-[#00704A] rounded-3xl px-8 py-12 md:px-14 md:py-14 relative overflow-hidden">
          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] font-semibold text-[#C4895A] uppercase tracking-widest mb-3">Comece hoje</p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
                Sua clínica organizada<br /><span className="italic font-serif text-[#C4895A]">em menos de uma tarde.</span>
              </h2>
              <p className="text-white/60 text-sm max-w-sm">
                14 dias grátis, sem cartão de crédito. Em poucos minutos, e com a gente junto, você recebe o primeiro agendamento ainda hoje.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3">
              <button onClick={() => navigate("/cadastro")}
                className="bg-white text-[#00704A] px-7 py-3.5 rounded-xl font-bold text-sm hover:bg-[#FAF7F2] transition">
                Criar conta grátis
              </button>
              <button onClick={() => navigate("/login")}
                className="text-white/70 text-sm hover:text-white transition">
                Fazer login →
              </button>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-16 w-72 h-72 rounded-full bg-white/5" />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#EFE7DA]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <Logo />
            <p className="text-xs text-gray-400">Tecnologia que cuida de quem cuida.</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="#features" className="hover:text-[#00704A] transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-[#00704A] transition">Planos</a>
            <a href="#depoimentos" className="hover:text-[#00704A] transition">Depoimentos</a>
            <a href={ADMIN_URL} className="hover:text-[#00704A] transition">Admin</a>
          </div>
          <p className="text-xs text-gray-300">© 2026 iasoclin · França, SP</p>
        </div>
      </footer>
    </div>
  );
}
