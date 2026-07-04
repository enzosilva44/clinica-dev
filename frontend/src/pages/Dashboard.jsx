import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, Wallet, BarChart2,
  ArrowRight, Cake, PartyPopper, Plus, Eye, EyeOff,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button } from "../components/ui";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useFeatures } from "../hooks/useFeatures";

const DAILY_QUOTES = [
  "Cada atendimento é uma oportunidade de transformar autoestima em confiança.",
  "Excelência não é um ato, é um hábito cultivado dia a dia.",
  "Harmonia entre arte e ciência — é isso que você pratica todos os dias.",
  "Você não apenas realiza procedimentos — você transforma histórias.",
  "Cuidar com precisão é uma forma de respeito. Seu trabalho mostra isso.",
  "A consistência nos pequenos detalhes cria resultados extraordinários.",
  "Cada paciente que sai satisfeito carrega sua dedicação para o mundo.",
  "Arte, técnica e empatia: a tríade de quem transforma vidas.",
  "O cuidado que você oferece hoje planta confiança para amanhã.",
  "Resultados naturais são o maior elogio à sua habilidade.",
  "A beleza que você realça já estava lá — você apenas a revelou.",
  "Cada detalhe importa. Você já sabe disso melhor do que ninguém.",
  "Transformar autoestima é transformar qualidade de vida.",
  "Seu cuidado com cada paciente é o que diferencia um atendimento inesquecível.",
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}

const PROFESSIONAL_COLORS = {
  "Dra Ana":    "#00704A",
  "Dra Julia":  "#6F7F73",
  "Dra Camila": "#C4895A",
};

// Ciclo de cores pastel para avatares (iniciais do paciente) — mesma paleta de tokens da marca.
const AVATAR_TONES = [
  { bg: "bg-verde-100",   text: "text-verde-700" },
  { bg: "bg-ambar-100",   text: "text-ambar-600" },
  { bg: "bg-[#D9E8F5]",   text: "text-[#4A8EC2]" }, // info
  { bg: "bg-[#F6DDE7]",   text: "text-[#D6618B]" }, // premium
];

function avatarTone(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

function initials(name) {
  return (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_STYLES = {
  SCHEDULED: { label: "Agendado",   bg: "bg-[#EAF1F7]", text: "text-[#3E6E97]", dot: "bg-[#4A8EC2]" },
  CONFIRMED: { label: "Confirmado", bg: "bg-verde-50",  text: "text-verde-900", dot: "bg-verde-400" },
  COMPLETED: { label: "Concluído",  bg: "bg-creme-100", text: "text-gray-500",  dot: "bg-gray-400" },
  CANCELED:  { label: "Cancelado",  bg: "bg-creme-100", text: "text-gray-400",  dot: "bg-gray-300" },
};

function statusStyle(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.SCHEDULED;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function getDisplayName(user) {
  const prefix = user?.gender === "F" ? "Dra." : user?.gender === "M" ? "Dr." : "";
  const name   = user?.nickname?.trim() || user?.name?.trim().split(" ")[0] || "";
  return prefix ? `${prefix} ${name}` : name;
}

function professionalColor(name) {
  return PROFESSIONAL_COLORS[name] ?? "#00704A";
}

function formatCurrency(value) {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Cabeçalho de seção padrão do Dashboard (ícone + título + subtítulo).
function SectionHeader({ icon: Icon, title, subtitle, action, bordered = false, iconColor }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-6 py-4 ${bordered ? "border-b border-creme-200" : "pb-4"}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={17} className={iconColor ?? "text-ambar"} />}
        <div>
          <h2 className="text-[15.5px] font-bold text-verde-900 leading-none">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 capitalize">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const features  = useFeatures();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const dailyInsight = getDailyQuote();
  const [hidePrivate, setHidePrivate] = useState(
    () => localStorage.getItem("dashboard_hide_private") === "1"
  );

  useEffect(() => {
    api.get("/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function togglePrivacy() {
    setHidePrivate((prev) => {
      const next = !prev;
      localStorage.setItem("dashboard_hide_private", next ? "1" : "0");
      return next;
    });
  }

  // Mascara o dado (nome, número) mantendo o layout — para prints/stories sem expor dados de pacientes.
  function mask(value) {
    return hidePrivate ? "••••••" : value;
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  const todaySchedule = stats?.todaySchedule ?? [];
  const hasSchedule = todaySchedule.length > 0;
  const birthdays = stats?.birthdaysThisMonth ?? [];
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const attendanceRate = stats?.attendanceRate;
  const weekAppointments = stats?.weekAppointments ?? 0;
  const professionalsToday = features.multiProfessional
    ? [...new Set(todaySchedule.map((a) => a.professional).filter(Boolean))]
    : [];

  const quickAccess = [
    {
      to: "/agenda", icon: Calendar, label: "Agenda",
      sub: `${mask(stats?.todayAppointments ?? 0)} ${stats?.todayAppointments === 1 ? "atendimento" : "atendimentos"} hoje`,
    },
    {
      to: "/patients", icon: Users, label: "Pacientes",
      sub: `${mask(stats?.totalPatients ?? 0)} ativos`,
    },
    {
      to: "/financeiro", icon: Wallet, label: "Financeiro",
      sub: `${mask(formatCurrency(stats?.todayRevenue))} hoje`,
    },
    {
      to: "/relatorios", icon: BarChart2, label: "Relatórios",
      sub: "análises e IA",
    },
  ];

  return (
    <MainLayout>
      {/* GREETING */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm capitalize mb-0.5">{today}</p>
          <h1 className="font-serif font-light text-3xl md:text-4xl text-verde-900 leading-tight tracking-tight">
            {getGreeting()}, {getDisplayName(user)}
          </h1>
          <p className="font-serif italic text-ambar-600 mt-1.5 text-[15.5px] max-w-lg">
            {dailyInsight ? `"${dailyInsight}"` : <span className="animate-pulse">Gerando frase do dia…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <Button
            variant="secondary"
            size="md"
            onClick={togglePrivacy}
            title={hidePrivate ? "Mostrar dados" : "Ocultar dados para print/story"}
          >
            {hidePrivate ? <EyeOff size={16} /> : <Eye size={16} />}
            {hidePrivate ? "Dados ocultos" : "Ocultar dados"}
          </Button>
          <Button onClick={() => navigate("/agenda")}>
            <Plus size={16} /> Novo agendamento
          </Button>
        </div>
      </div>

      {/* QUICK ACCESS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5.5">
        {quickAccess.map(({ to, icon: Icon, label, sub }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="group bg-white border border-creme-200 hover:border-ambar/40 hover:-translate-y-0.5 hover:shadow-lg rounded-2xl p-4.5 flex flex-col items-start gap-3 transition-all shadow-sm text-left"
          >
            <div className="w-10 h-10 bg-verde-50 rounded-xl flex items-center justify-center">
              <Icon size={20} className="text-verde" />
            </div>
            <div>
              <p className="font-bold text-sm text-verde-900">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* AGENDA + ANIVERSARIANTES */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* AGENDA DE HOJE */}
        <Card className="bg-white! p-0! overflow-hidden">
          <SectionHeader
            bordered
            title="Agenda de hoje"
            subtitle={
              hasSchedule
                ? `${todaySchedule.length} ${todaySchedule.length === 1 ? "atendimento" : "atendimentos"}${
                    professionalsToday.length > 1 ? ` · ${professionalsToday.length} profissionais` : ""
                  }`
                : undefined
            }
            action={
              <button
                onClick={() => navigate("/agenda")}
                className="text-xs text-verde hover:bg-verde-50 transition flex items-center gap-1.5 font-bold px-3 py-2 rounded-lg shrink-0"
              >
                Abrir agenda completa <ArrowRight size={13} />
              </button>
            }
          />

          {/* Legenda de profissionais do dia */}
          {!loading && professionalsToday.length > 1 && (
            <div className="flex items-center gap-4 px-6 py-2.5 bg-creme-50 border-b border-creme-200">
              {professionalsToday.map((name) => (
                <span key={name} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: professionalColor(name) }} />
                  {name}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-creme-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !hasSchedule ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-creme-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar size={22} className="text-ambar" />
              </div>
              <p className="text-gray-500 text-sm font-medium">Nenhum atendimento hoje</p>
              <p className="text-gray-400 text-xs mt-1">Aproveite para organizar a semana</p>
              <Button size="sm" className="mt-4" onClick={() => navigate("/agenda")}>
                Abrir agenda
              </Button>
            </div>
          ) : (
            <div>
              {todaySchedule.map((appt) => {
                const time = new Date(appt.startsAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit", minute: "2-digit",
                });
                const color = features.multiProfessional ? professionalColor(appt.professional) : "#00704A";
                const name = appt.patient?.name ?? appt.title;
                const tone = avatarTone(name);
                const status = statusStyle(appt.status);

                return (
                  <div key={appt.id} className="flex items-center gap-3.5 px-5 py-3.5 border-t border-creme-200 hover:bg-creme-50 transition">
                    {/* Horário */}
                    <p className="text-[12.5px] font-mono font-semibold text-gray-600 shrink-0 w-11">{time}</p>

                    {/* Barra de cor do profissional */}
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: color, minHeight: 36 }}
                    />

                    {/* Avatar iniciais */}
                    <div className={`w-9 h-9 rounded-full ${tone.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs font-bold ${tone.text}`}>{hidePrivate ? "••" : initials(name)}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-verde-900 text-sm truncate">{mask(name)}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {appt.procedureType || "Sem procedimento"}
                        {features.multiProfessional && appt.professional ? ` · ${appt.professional}` : ""}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* COLUNA DIREITA */}
        <div className="space-y-4">
          {/* ANIVERSARIANTES DO MÊS */}
          <Card className="bg-white! p-0! overflow-hidden">
            <SectionHeader icon={Cake} iconColor="text-ambar-500" title={`Aniversariantes de ${currentMonthName}`} />

            {loading ? (
              <div className="px-6 pb-6 space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-12 bg-creme-100 rounded-xl animate-pulse" />)}
              </div>
            ) : birthdays.length === 0 ? (
              <p className="text-sm text-gray-400 text-center pb-6">
                Nenhum aniversariante em {currentMonthName}.
              </p>
            ) : (
              <>
                {birthdays.filter((p) => p.isToday).map((p) => (
                  <div
                    key={p.id}
                    className="mx-3.5 mb-2.5 bg-gradient-to-br from-ambar-50 to-ambar-100/60 border border-ambar-200 rounded-xl p-3.5 flex items-center gap-3"
                  >
                    <div className="w-9.5 h-9.5 rounded-full bg-ambar-500 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{hidePrivate ? "••" : initials(p.name)}</span>
                    </div>
                    <button onClick={() => navigate(`/patients/${p.id}`)} className="min-w-0 flex-1 text-left">
                      <p className="text-[13.5px] font-bold text-verde-900 truncate">{mask(p.name)}</p>
                      <p className="text-[11.5px] text-ambar-600 font-semibold">faz aniversário hoje</p>
                    </button>
                    <button className="shrink-0 flex items-center gap-1.5 bg-ambar-500 hover:bg-ambar-600 transition text-white text-[11.5px] font-bold rounded-lg px-2.5 py-1.5">
                      <PartyPopper size={12} /> Parabenizar
                    </button>
                  </div>
                ))}
                {birthdays.filter((p) => !p.isToday).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-creme-200">
                    <div className={`w-7.5 h-7.5 rounded-full ${avatarTone(p.name).bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-[11px] font-bold ${avatarTone(p.name).text}`}>{hidePrivate ? "••" : initials(p.name)}</span>
                    </div>
                    <button onClick={() => navigate(`/patients/${p.id}`)} className="min-w-0 flex-1 text-left">
                      <p className="text-[13px] font-semibold text-verde-900 truncate">{mask(p.name)}</p>
                    </button>
                    <span className="text-[11.5px] font-mono text-gray-400 shrink-0">
                      {String(p.day).padStart(2, "0")} {currentMonthName.slice(0, 3)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </Card>

          {/* RESUMO DA SEMANA */}
          {!loading && (
            <div className="relative bg-gradient-to-br from-verde to-verde-900 rounded-2xl p-5 overflow-hidden">
              <svg viewBox="0 0 200 120" className="absolute -right-10 -bottom-12 w-48 opacity-[.14] pointer-events-none" fill="none">
                <path d="M170 10 A80 80 0 1 1 30 10" stroke="#fff" strokeWidth="1.5" />
                <path d="M150 24 A56 56 0 1 1 50 24" stroke="#fff" strokeWidth="1" />
                <path d="M132 36 A34 34 0 1 1 68 36" stroke="#fff" strokeWidth=".7" />
              </svg>
              <p className="relative text-verde-200 text-[11px] font-mono font-semibold uppercase tracking-widest mb-2.5">
                Resumo da semana
              </p>
              <p className="relative font-serif font-light text-white text-[19px] leading-snug">
                Semana com {mask(`${attendanceRate ?? 0}%`)} de presença.{" "}
                {weekAppointments > 0
                  ? `${mask(weekAppointments)} atendimento${weekAppointments === 1 ? "" : "s"} nos próximos 7 dias.`
                  : "Nenhum atendimento novo agendado para os próximos dias."}
              </p>
              <button
                onClick={() => navigate("/relatorios")}
                className="relative mt-3.5 text-[12.5px] font-semibold text-white bg-white/10 hover:bg-white/[.18] transition rounded-[10px] px-3.5 py-2"
              >
                Ver relatórios
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
