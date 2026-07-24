import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, Stethoscope, FileSignature, MessageSquare, Sparkles,
  Wallet, Check, ChevronRight, Star, Quote, ShieldCheck, Package, RotateCcw,
  Target, Compass, Heart,
} from "lucide-react";
import { LogoMark } from "../components/ui/Logo.jsx";
import { PLANS, ANNUAL_DISCOUNT, BRL } from "../config/plans.js";

// URL da área administrativa (app separado)
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "https://admin.iasoclin.com.br";

function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark variant={light ? "rev" : "color"} size={26} />
      <span className="text-lg font-bold">
        <span className={light ? "text-white" : "text-verde"}>Iaso</span>
        <span className="text-ambar">clin</span>
      </span>
    </div>
  );
}

const FEATURES = [
  { icon: CalendarCheck, title: "Agenda & sessões",        desc: "Agendamentos, pacotes de sessões e atendimentos avulsos, com confirmação automática por WhatsApp." },
  { icon: Stethoscope,   title: "Prontuário clínico",      desc: "Ficha do paciente, evolução e mapa dos procedimentos realizados em cada região do corpo." },
  { icon: FileSignature, title: "Documentos jurídicos",    desc: "Anamnese e termos assinados virtualmente, com validade jurídica. Conformidade sem papel." },
  { icon: Wallet,        title: "Financeiro automatizado", desc: "Cada agendamento vira lançamento. Caixa, estoque e receita conversando sozinhos." },
  { icon: MessageSquare, title: "Faturamento por WhatsApp",desc: "Link de cobrança enviado automaticamente conforme o status do agendamento. Receita em dia." },
  { icon: Sparkles,      title: "Insights com IA",         desc: "Leituras do negócio e ações práticas: pacientes sumidos, tendências e oportunidades." },
];

// Guardião IA — o diferencial em destaque
const GUARDIAO = [
  { icon: ShieldCheck, title: "Guardião do financeiro",  desc: "Detecta divergências no caixa antes que virem prejuízo." },
  { icon: Package,     title: "Guardião do estoque",     desc: "Avisa reposição e consumo fora do padrão por procedimento." },
  { icon: RotateCcw,   title: "Reativação de pacientes", desc: "Identifica quem sumiu e prepara a mensagem de retorno." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false); // toggle mensal/anual da seção de planos

  return (
    <div className="min-h-screen bg-white font-sans text-[#1F2D2A]">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-creme-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
            <a href="#features"    className="hover:text-verde transition">Funcionalidades</a>
            <a href="#planos"      className="hover:text-verde transition">Planos</a>
            <a href="#tracao" className="hover:text-verde transition">Clínicas</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={ADMIN_URL} className="hidden sm:block text-sm text-gray-400 font-medium hover:text-verde transition">Área Admin</a>
            <button onClick={() => navigate("/login")} className="text-sm text-verde font-medium hover:opacity-70 transition">Entrar</button>
            <button onClick={() => navigate("/comece-agora")} className="bg-verde hover:bg-verde-900 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
              Começar grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bg-creme-50 border-b border-creme-100">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-verde/8 text-verde text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Sparkles size={12} /> Novo · Agenda com IA integrada
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-[#141414] leading-[1.1] mb-5">
              Sua clínica<br />organizada do<br />
              <span className="italic font-serif text-verde">jeito certo.</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-md">
              Agenda, atendimentos, prontuário, financeiro e WhatsApp em um só lugar — com IA cuidando da rotina junto com você, pra sua clínica crescer no controle.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate("/comece-agora")}
                className="bg-verde hover:bg-verde-900 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-verde/15">
                Teste grátis por 14 dias <ChevronRight size={16} />
              </button>
              <button onClick={() => navigate("/login")}
                className="border border-creme-200 text-verde px-6 py-3.5 rounded-xl font-medium text-sm hover:bg-white transition">
                Ver demonstração →
              </button>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <div className="flex -space-x-2">
                {["#00704A", "#C4895A", "#6F7F73", "#2E6FA8"].map((c) => (
                  <div key={c} className="w-7 h-7 rounded-full border-2 border-creme-50" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-ambar">
                  {[...Array(5)].map((_, i) => <Star key={i} size={11} fill="#C4895A" />)}
                </div>
                <p className="text-[11px] text-gray-400">+100 clínicas ativas · sem fidelidade</p>
              </div>
            </div>
          </div>

          {/* Mockup do dashboard */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-creme-100 overflow-hidden">
              <div className="bg-verde px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-white/80 text-xs font-medium ml-2">iasoclin</span>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-3">Bom dia, <span className="font-semibold text-verde">Ana Flávia</span></p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { v: "8",      l: "hoje",     c: "#00704A" },
                    { v: "R$ 9,2k",l: "+28% mês", c: "#C4895A" },
                    { v: "14",     l: "retornos", c: "#2E6FA8" },
                  ].map((k) => (
                    <div key={k.l} className="bg-creme-50 rounded-xl p-2.5">
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
        <p className="text-xs font-semibold text-ambar uppercase tracking-widest mb-3">Funcionalidades</p>
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
                <Icon size={18} className="text-verde" />
              </div>
              <h3 className="font-bold text-[#141414] mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GUARDIÃO IA ── */}
      <section className="bg-verde-900 border-y border-verde-900">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-white/10 text-verde-100 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <ShieldCheck size={12} /> Diferencial iasoclin
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
              O <span className="italic font-serif text-ambar">Guardião</span> que vigia<br />o que você não tem tempo de olhar.
            </h2>
            <p className="text-white/60 leading-relaxed max-w-md">
              Uma camada de IA acompanha financeiro e estoque em tempo real: alerta quando um número foge do esperado, quando um produto está acabando e quando um paciente parou de voltar — com a ação certa já sugerida.
            </p>
          </div>
          <div className="space-y-4">
            {GUARDIAO.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/6 border border-white/10 rounded-2xl p-5 flex gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-verde-100" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-ambar uppercase tracking-widest mb-3">Planos</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#141414] mb-2">Simples assim.</h2>
          <p className="text-gray-500">Todos os recursos em todos os planos. Você escolhe pelo tamanho da sua clínica — a gente cresce junto.</p>
        </div>

        {/* Toggle mensal / anual */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className={`text-sm font-medium transition ${!annual ? "text-[#141414]" : "text-gray-400"}`}>Mensal</span>
          <button
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual((v) => !v)}
            className="relative w-13 h-7 rounded-full transition-colors"
            style={{ background: annual ? "var(--verde)" : "var(--creme-300)" }}
          >
            <span className="absolute top-0.75 w-5.5 h-5.5 rounded-full bg-white shadow transition-all"
              style={{ left: annual ? "27px" : "3px" }} />
          </button>
          <span className={`text-sm font-medium transition ${annual ? "text-[#141414]" : "text-gray-400"}`}>
            Anual <span className="text-verde font-bold">−{Math.round(ANNUAL_DISCOUNT * 100)}%</span>
          </span>
        </div>
        <p className="text-center text-xs text-gray-400 mb-12">
          {annual ? "Pague uma vez por ano e economize 10% em qualquer plano." : "Sem fidelidade. Cancele quando quiser."}
        </p>

        <div className="grid md:grid-cols-4 gap-4 items-start">
          {PLANS.map((plan) => {
            const isEnterprise = plan.monthly == null;
            const price = annual ? plan.priceAnnualLabel : plan.priceMonthlyLabel;
            return (
              <div key={plan.id}
                className={`rounded-2xl border p-6 relative ${plan.highlight ? "border-verde shadow-xl shadow-verde/10 bg-white" : "border-creme-100 bg-white"}`}>
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-verde text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Mais escolhido
                  </span>
                )}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{plan.name}</p>

                {isEnterprise ? (
                  <div className="mb-1">
                    <span className="text-2xl font-black text-verde">Sob consulta</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-black text-verde">{price}</span>
                      <span className="text-sm text-gray-400">/mês</span>
                    </div>
                    {annual ? (
                      <p className="text-[11px] text-verde font-semibold mb-1">
                        Economize {BRL(plan.savings)}/ano
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-300 mb-1">&nbsp;</p>
                    )}
                  </>
                )}
                <p className="text-xs text-gray-400 mb-5">{plan.sub}</p>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={15} className="text-verde shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate(isEnterprise ? "/comece-agora" : "/comece-agora")}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
                    plan.highlight ? "bg-verde hover:bg-verde-900 text-white" : "border border-creme-200 text-verde hover:bg-creme-50"
                  }`}>
                  {isEnterprise ? "Falar com a gente" : "Começar grátis"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── COMO SURGIU ── */}
      <section className="bg-creme-50 border-y border-creme-100">
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
          <div className="bg-white border border-creme-100 rounded-2xl p-6">
            <Quote size={24} className="text-ambar mb-3" />
            <p className="text-[#141414] leading-relaxed mb-4 italic font-serif">
              "Minha cunhada biomédica não conseguia ter controle de nada na clínica dela. Sem agenda, sem cobrança, sem histórico. Aquilo me incomodava — e não saía mais da minha cabeça."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-verde text-white text-xs font-bold flex items-center justify-center">EO</div>
              <div>
                <p className="text-sm font-bold text-[#141414]">Enzo Oliveira</p>
                <p className="text-xs text-gray-400">Co-fundador & CTO</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROPÓSITO ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-semibold text-ambar uppercase tracking-widest mb-3">Nosso propósito</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#141414] leading-tight mb-10 max-w-2xl">
          Tornar o mercado de estética organizado operacionalmente e <span className="italic font-serif text-verde">alinhado à tecnologia.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Compass, t: "Visão",   d: "Ser a plataforma de gestão mais usada por clínicas de estética no Brasil." },
            { icon: Target,  t: "Missão",  d: "Dar governança real a clínicas que merecem crescer sem depender de planilha ou caderno." },
            { icon: Heart,   t: "Valores", d: "Simplicidade antes de sofisticação. Transparência com o parceiro. Tecnologia que cuida de quem cuida." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon size={18} className="text-verde mb-2" />
              <p className="font-bold text-[#141414] mb-1">{t}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRAÇÃO ── */}
      <section id="tracao" className="bg-creme-50 border-y border-creme-100">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-semibold text-ambar uppercase tracking-widest mb-3">Onde estamos</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#141414] mb-3">
            <span className="text-verde">+100 clínicas</span> já ativas.
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-12">
            Antes mesmo do lançamento oficial, mais de 100 profissionais já organizam a rotina da clínica com o iasoclin todos os dias.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { v: "+100", l: "clínicas ativas no dia a dia" },
              { v: "6", l: "módulos integrados num só sistema" },
              { v: "< 1", l: "tarde para colocar a clínica no ar" },
            ].map((s) => (
              <div key={s.l} className="bg-white border border-creme-100 rounded-2xl p-6">
                <p className="text-4xl font-black text-verde mb-2">{s.v}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-verde rounded-3xl px-8 py-12 md:px-14 md:py-14 relative overflow-hidden">
          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[10px] font-semibold text-ambar uppercase tracking-widest mb-3">Comece hoje</p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
                Sua clínica organizada<br /><span className="italic font-serif text-ambar">em menos de uma tarde.</span>
              </h2>
              <p className="text-white/60 text-sm max-w-sm">
                14 dias grátis, sem cartão de crédito. Em poucos minutos, e com a gente junto, você recebe o primeiro agendamento ainda hoje.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3">
              <button onClick={() => navigate("/comece-agora")}
                className="bg-white text-verde px-7 py-3.5 rounded-xl font-bold text-sm hover:bg-creme-50 transition">
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
      <footer className="border-t border-creme-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <Logo />
            <p className="text-xs text-gray-400">Tecnologia que cuida de quem cuida.</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="#features" className="hover:text-verde transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-verde transition">Planos</a>
            <a href="#tracao" className="hover:text-verde transition">Clínicas</a>
            <a href={ADMIN_URL} className="hover:text-verde transition">Admin</a>
          </div>
          <p className="text-xs text-gray-300">© 2026 iasoclin · França, SP</p>
        </div>
      </footer>
    </div>
  );
}
