import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, Wallet, BarChart2,
  ArrowRight, TrendingUp, Clock, ChevronRight, Cake, PartyPopper,
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

const QUICK_ACCESS = [
  { to: "/agenda",     icon: Calendar,  label: "Agenda",     sub: "Agendamentos" },
  { to: "/patients",   icon: Users,     label: "Pacientes",  sub: "Prontuários" },
  { to: "/financeiro", icon: Wallet,    label: "Financeiro", sub: "Fluxo de caixa" },
  { to: "/relatorios", icon: BarChart2, label: "Relatórios", sub: "Analytics" },
];

// Cabeçalho de seção padrão do Dashboard (ícone + título + subtítulo).
function SectionHeader({ icon: Icon, title, subtitle, iconTone = "creme", action }) {
  const box = iconTone === "verde" ? "bg-verde" : "bg-creme-100";
  const glyph = iconTone === "verde" ? "text-white" : "text-ambar";
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 ${box} rounded-lg flex items-center justify-center`}>
          <Icon size={15} className={glyph} />
        </div>
        <div>
          <h2 className="text-base font-bold text-verde leading-none">{title}</h2>
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

  useEffect(() => {
    api.get("/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);


  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  const todaySchedule = stats?.todaySchedule ?? [];
  const hasSchedule = todaySchedule.length > 0;
  const birthdays = stats?.birthdaysThisMonth ?? [];
  const currentMonthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <MainLayout>
      {/* GREETING */}
      <div className="relative bg-verde rounded-2xl px-5 py-6 md:px-8 md:py-7 mb-6 overflow-hidden shadow-sm">
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-medium capitalize tracking-widest mb-2">
            {today}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {getGreeting()}, {getDisplayName(user)}!
          </h1>
          <p className="text-white/60 mt-3 text-sm max-w-lg leading-relaxed italic">
            {dailyInsight ? `"${dailyInsight}"` : <span className="animate-pulse">Gerando frase do dia…</span>}
          </p>
        </div>
        {/* decorativo */}
        <TrendingUp
          size={160}
          className="absolute -right-6 -bottom-8 text-white/5"
          strokeWidth={1}
        />
        <div className="absolute top-0 right-0 w-64 h-full bg-linear-to-l from-white/5 to-transparent rounded-2xl" />
      </div>

      {/* QUICK ACCESS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {QUICK_ACCESS.map(({ to, icon: Icon, label, sub }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="group bg-creme-50 border border-creme-200 hover:border-verde/30 hover:bg-white rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm text-left"
          >
            <div>
              <div className="w-9 h-9 bg-creme-100 group-hover:bg-verde rounded-xl flex items-center justify-center mb-3 transition-colors">
                <Icon size={17} className="text-verde group-hover:text-white transition-colors" />
              </div>
              <p className="font-semibold text-sm text-verde">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-verde transition-colors shrink-0" />
          </button>
        ))}
      </div>

      {/* ANIVERSARIANTES DO MÊS */}
      <Card className="bg-creme-50! p-6 mb-6">
          <SectionHeader icon={Cake} title="Aniversariantes" subtitle={currentMonthName} />

          {loading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-28 bg-creme-100 rounded-xl animate-pulse shrink-0" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {birthdays.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition text-left ${
                    p.isToday
                      ? "bg-ambar border-ambar shadow-sm"
                      : "bg-white border-creme-200 hover:border-ambar/40 hover:bg-ambar-50"
                  }`}
                >
                  <div className={`leading-none ${p.isToday ? "animate-bounce" : ""}`}>
                    <Cake size={18} className={p.isToday ? "text-white" : "text-ambar"} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold leading-tight truncate max-w-27.5 ${p.isToday ? "text-white" : "text-verde"}`}>
                      {p.name.split(" ")[0]}
                    </p>
                    <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${p.isToday ? "text-white/80" : "text-gray-400"}`}>
                      {p.isToday ? <><PartyPopper size={10} /> Hoje!</> : `Dia ${p.day}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && birthdays.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-3">
              Nenhum aniversariante em {currentMonthName}.
            </p>
          )}
        </Card>

      {/* AGENDA DE HOJE */}
      <Card className="bg-creme-50! p-6">
        <SectionHeader
          icon={Calendar}
          iconTone="verde"
          title="Agenda de hoje"
          subtitle={hasSchedule ? `${todaySchedule.length} ${todaySchedule.length === 1 ? "consulta" : "consultas"} agendadas` : undefined}
          action={
            <button
              onClick={() => navigate("/agenda")}
              className="text-xs text-verde hover:opacity-70 transition flex items-center gap-1 font-medium"
            >
              Ver agenda completa <ArrowRight size={13} />
            </button>
          }
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-creme-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !hasSchedule ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-creme-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar size={22} className="text-ambar" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhuma consulta hoje</p>
            <p className="text-gray-400 text-xs mt-1">Aproveite para organizar a semana</p>
            <Button size="sm" className="mt-4" onClick={() => navigate("/agenda")}>
              Abrir agenda
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todaySchedule.map((appt) => {
              const time = new Date(appt.startsAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit", minute: "2-digit",
              });
              const endTime = appt.endsAt
                ? new Date(appt.endsAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit", minute: "2-digit",
                  })
                : null;
              const color = features.multiProfessional ? professionalColor(appt.professional) : "#00704A";
              const isPast = new Date(appt.endsAt ?? appt.startsAt) < new Date();
              const isNow =
                new Date(appt.startsAt) <= new Date() &&
                new Date(appt.endsAt ?? appt.startsAt) >= new Date();

              return (
                <div
                  key={appt.id}
                  className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 transition ${
                    isPast ? "opacity-45" : "border-creme-200"
                  } ${isNow ? "border-l-4 shadow-sm" : ""}`}
                  style={isNow ? { borderLeftColor: color } : {}}
                >
                  {/* Barra de cor do profissional */}
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: color, minHeight: 36 }}
                  />

                  {/* Horário */}
                  <div className="text-right shrink-0 w-16">
                    <p className="text-sm font-bold text-verde">{time}</p>
                    {endTime && (
                      <p className="text-xs text-gray-400">{endTime}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-creme-200 shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-verde text-sm truncate">
                      {appt.patient?.name ?? appt.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {appt.procedureType || "Sem procedimento"}
                      {features.multiProfessional && appt.professional ? ` · ${appt.professional}` : ""}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {isNow ? (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Em andamento
                      </span>
                    ) : isPast ? (
                      <span className="text-xs text-gray-400 px-2.5 py-1 rounded-full bg-gray-50">
                        Concluído
                      </span>
                    ) : (
                      <Clock size={14} className="text-gray-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </MainLayout>
  );
}
