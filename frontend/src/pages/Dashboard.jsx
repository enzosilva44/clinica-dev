import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, Wallet, BarChart2,
  ArrowRight, TrendingUp, Clock, ChevronRight, Cake,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const QUOTES = [
  "Cada atendimento é uma oportunidade de transformar autoestima em confiança.",
  "A beleza começa quando você decide cuidar de verdade.",
  "O sorriso de um paciente satisfeito é a melhor recompensa.",
  "Excelência não é um ato, é um hábito cultivado dia a dia.",
  "Cada detalhe importa quando o resultado é a felicidade do paciente.",
  "A confiança se conquista procedimento a procedimento.",
  "Transformar vidas começa com um gesto genuíno de cuidado.",
  "O verdadeiro sucesso é o bem-estar de quem confiou em você.",
  "Resultados excepcionais nascem de cuidados excepcionais.",
  "Hoje é um novo dia para fazer a diferença na vida de alguém.",
  "A perfeição está nos detalhes, e você domina cada um deles.",
  "Harmonia entre arte e ciência — é isso que você pratica todos os dias.",
  "Seja a razão de alguém sorrir hoje.",
  "Quem cuida bem dos outros, cuida do mundo.",
  "Sua dedicação é o melhor tratamento que um paciente pode receber.",
  "Grandes resultados começam com grandes intenções.",
  "A saúde e a beleza caminham juntas quando há amor no que se faz.",
  "Cada paciente que sai feliz carrega um pouco da sua essência.",
  "O cuidado genuíno é o diferencial que nenhum protocolo ensina.",
  "Você não apenas realiza procedimentos — você transforma histórias.",
];

const PROFESSIONAL_COLORS = {
  "Dra Ana":    "#314D3E",
  "Dra Julia":  "#7C9A92",
  "Dra Camila": "#C4A882",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite Dr. Enzo";
}

function getFirstName(name = "") {
  const parts = name.trim().split(" ");
  if (parts[0].match(/^Dr[a]?\.?$/i) && parts[1]) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

function professionalColor(name) {
  return PROFESSIONAL_COLORS[name] ?? "#314D3E";
}

const QUICK_ACCESS = [
  { to: "/agenda",     icon: Calendar,  label: "Agenda",     sub: "Agendamentos" },
  { to: "/patients",   icon: Users,     label: "Pacientes",  sub: "Prontuários" },
  { to: "/financeiro", icon: Wallet,    label: "Financeiro", sub: "Fluxo de caixa" },
  { to: "/relatorios", icon: BarChart2, label: "Relatórios", sub: "Analytics" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="relative bg-[#314D3E] rounded-2xl px-5 py-6 md:px-8 md:py-7 mb-6 overflow-hidden shadow-sm">
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-medium capitalize tracking-widest mb-2">
            {today}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {getGreeting()},<br />
            {getFirstName(user?.name)}!
          </h1>
          <p className="text-white/60 mt-3 text-sm max-w-lg leading-relaxed italic">
            "{getDailyQuote()}"
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
            className="group bg-[#FAF7F2] border border-[#E5D8C5] hover:border-[#314D3E]/30 hover:bg-white rounded-2xl p-4 flex items-center justify-between transition-all shadow-sm text-left"
          >
            <div>
              <div className="w-9 h-9 bg-[#EFE7DA] group-hover:bg-[#314D3E] rounded-xl flex items-center justify-center mb-3 transition-colors">
                <Icon size={17} className="text-[#314D3E] group-hover:text-white transition-colors" />
              </div>
              <p className="font-semibold text-sm text-[#314D3E]">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
            <ChevronRight size={15} className="text-gray-300 group-hover:text-[#314D3E] transition-colors shrink-0" />
          </button>
        ))}
      </div>

      {/* ANIVERSARIANTES DO MÊS */}
      <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-[#EFE7DA] rounded-lg flex items-center justify-center">
              <Cake size={15} className="text-[#C4895A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#314D3E] leading-none">Aniversariantes</h2>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{currentMonthName}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-28 bg-[#EFE7DA] rounded-xl animate-pulse shrink-0" />
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
                      ? "bg-[#C4895A] border-[#C4895A] shadow-sm"
                      : "bg-white border-[#E5D8C5] hover:border-[#C4895A]/40 hover:bg-[#FDF6EE]"
                  }`}
                >
                  <div className={`text-lg leading-none ${p.isToday ? "animate-bounce" : ""}`}>
                    🎂
                  </div>
                  <div>
                    <p className={`text-xs font-semibold leading-tight truncate max-w-27.5 ${p.isToday ? "text-white" : "text-[#314D3E]"}`}>
                      {p.name.split(" ")[0]}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${p.isToday ? "text-white/80" : "text-gray-400"}`}>
                      {p.isToday ? "Hoje! 🎉" : `Dia ${p.day}`}
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
        </div>

      {/* AGENDA DE HOJE */}
      <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#314D3E] rounded-lg flex items-center justify-center">
              <Calendar size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#314D3E] leading-none">Agenda de hoje</h2>
              {hasSchedule && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {todaySchedule.length} {todaySchedule.length === 1 ? "consulta" : "consultas"} agendadas
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate("/agenda")}
            className="text-xs text-[#314D3E] hover:opacity-70 transition flex items-center gap-1 font-medium"
          >
            Ver agenda completa <ArrowRight size={13} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#EFE7DA] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !hasSchedule ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-[#EFE7DA] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar size={22} className="text-[#D6C1A3]" />
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhuma consulta hoje</p>
            <p className="text-gray-400 text-xs mt-1">Aproveite para organizar a semana</p>
            <button
              onClick={() => navigate("/agenda")}
              className="mt-4 bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2 rounded-xl text-xs font-medium transition"
            >
              Abrir agenda
            </button>
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
              const color = professionalColor(appt.professional);
              const isPast = new Date(appt.endsAt ?? appt.startsAt) < new Date();
              const isNow =
                new Date(appt.startsAt) <= new Date() &&
                new Date(appt.endsAt ?? appt.startsAt) >= new Date();

              return (
                <div
                  key={appt.id}
                  className={`flex items-center gap-4 bg-white border rounded-xl px-4 py-3.5 transition ${
                    isPast ? "opacity-45" : "border-[#E5D8C5]"
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
                    <p className="text-sm font-bold text-[#314D3E]">{time}</p>
                    {endTime && (
                      <p className="text-xs text-gray-400">{endTime}</p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-[#E5D8C5] shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#314D3E] text-sm truncate">
                      {appt.patient?.name ?? appt.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {appt.procedureType || "Sem procedimento"}
                      {appt.professional ? ` · ${appt.professional}` : ""}
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
      </div>
    </MainLayout>
  );
}
