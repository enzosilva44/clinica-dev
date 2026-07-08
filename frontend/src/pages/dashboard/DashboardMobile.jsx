import { useNavigate } from "react-router-dom";
import { Calendar, Users, DollarSign, BarChart3 } from "lucide-react";

// UI mobile do Dashboard/Início — fiel ao protótipo Iasoclin Mobile.
// Recebe os dados já carregados por Dashboard.jsx via props (sem duplicar loads).

function initials(name) {
  return (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_BADGE = {
  SCHEDULED:   { bg: "#FAF0E4", fg: "#A86E43", label: "Agendado" },
  CONFIRMED:   { bg: "#D4E9E2", fg: "#006241", label: "Confirmado" },
  IN_PROGRESS: { bg: "#FBF0D9", fg: "#8A6D1B", label: "Em atend." },
  FINISHED:    { bg: "#D4E9E2", fg: "#006241", label: "Concluído" },
  CANCELED:    { bg: "#F6E0DD", fg: "#B0433A", label: "Cancelado" },
};

const BAR_COLOR = { SCHEDULED: "#C4895A", CONFIRMED: "#00704A", IN_PROGRESS: "#D4A017", FINISHED: "#3A9B6F", CANCELED: "#B05248" };

const SHORTCUTS = [
  { label: "Agenda",     icon: Calendar,   path: "/agenda" },
  { label: "Pacientes",  icon: Users,      path: "/patients" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Relatórios", icon: BarChart3,  path: "/analytics" },
];

export default function DashboardMobile({ greeting, name, user, todaySchedule = [], birthdays = [], monthName }) {
  const navigate = useNavigate();
  const todayBdays = birthdays.filter((p) => p.isToday);
  const nextBdays = birthdays.filter((p) => !p.isToday);

  return (
    <div className="px-[18px] pt-5 pb-6 bg-[#FAF7F2] min-h-full">
      {/* topo: logo + avatar */}
      <div className="flex justify-between items-center mb-[18px]">
        <span className="font-light text-base text-[#0A3326]">
          iaso<strong className="font-bold text-[#00704A]">clin</strong>
        </span>
        <div className="w-9 h-9 rounded-full bg-[#00704A] text-white flex items-center justify-center text-[13px] font-bold">
          {initials(user?.name || name)}
        </div>
      </div>

      {/* saudação */}
      <h1 className="font-serif font-light text-[28px] leading-[1.15] m-0 mb-1 text-[#0A3326]">
        {greeting}, <em className="not-italic font-normal italic text-[#00704A]">{name}</em>
      </h1>
      <div className="text-[13px] text-[#6f7d74] mb-5">Bem-vinda de volta ao controle da clínica.</div>

      {/* atalhos */}
      <div className="grid grid-cols-4 gap-2.5 mb-[22px]">
        {SHORTCUTS.map(({ label, icon: Icon, path }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className="bg-white border border-[#ECE2D2] rounded-[14px] py-3 px-1.5 text-center"
          >
            <Icon size={20} className="mx-auto" color="#00704A" strokeWidth={2} />
            <div className="text-[10.5px] font-bold mt-1.5 text-[#0A3326]">{label}</div>
          </button>
        ))}
      </div>

      {/* hoje na clínica */}
      <div className="flex justify-between items-baseline mb-2.5">
        <div className="text-[14.5px] font-bold text-[#0A3326]">Hoje na clínica</div>
        <button onClick={() => navigate("/agenda")} className="text-xs font-bold text-[#00704A]">
          Agenda completa →
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-[22px]">
        {todaySchedule.length === 0 ? (
          <div className="bg-white border border-[#ECE2D2] rounded-[14px] py-6 text-center text-sm text-[#9aa69e]">
            Nenhum atendimento hoje.
          </div>
        ) : (
          todaySchedule.map((appt) => {
            const time = new Date(appt.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            const badge = STATUS_BADGE[appt.status] || STATUS_BADGE.SCHEDULED;
            const bar = BAR_COLOR[appt.status] || "#00704A";
            const pname = appt.patient?.name ?? appt.title;
            return (
              <div key={appt.id} className="bg-white border border-[#ECE2D2] rounded-[14px] px-3.5 py-3 flex items-center gap-3">
                <div className="font-mono text-xs font-semibold text-[#00704A]">{time}</div>
                <div className="w-[3px] h-8 rounded-[2px]" style={{ background: bar }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold truncate text-[#0A3326]">{pname}</div>
                  <div className="text-[11.5px] text-[#6f7d74] truncate">
                    {appt.procedureType || "Sem procedimento"}{appt.professional ? ` · ${appt.professional}` : ""}
                  </div>
                </div>
                <span className="rounded-[6px] px-2 py-[3px] text-[10px] font-bold shrink-0" style={{ background: badge.bg, color: badge.fg }}>
                  {badge.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* aniversariantes */}
      <div className="text-[14.5px] font-bold mb-2.5 text-[#0A3326]">Aniversariantes de {monthName}</div>
      {todayBdays.map((p) => (
        <div key={p.id} className="bg-[#06251B] rounded-[16px] p-3.5 flex items-center gap-3 mb-2.5">
          <div className="w-10 h-10 rounded-full bg-[#A9DEC8] text-[#06251B] flex items-center justify-center text-[13px] font-bold">
            {initials(p.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold text-white truncate">{p.name}</div>
            <div className="text-[11.5px] text-[#A9DEC8]">faz aniversário hoje 🎂</div>
          </div>
          <button
            onClick={() => navigate(`/patients/${p.id}`)}
            className="bg-[#00704A] text-white rounded-[9px] px-3 py-2 text-[11.5px] font-bold shrink-0"
          >
            Parabenizar
          </button>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        {nextBdays.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/patients/${p.id}`)}
            className="bg-white border border-[#ECE2D2] rounded-[12px] px-3.5 py-2.5 flex items-center gap-2.5 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[#EFE7DA] text-[#7c756a] flex items-center justify-center text-[11px] font-bold">
              {initials(p.name)}
            </div>
            <div className="flex-1 text-[12.5px] font-semibold text-[#0A3326] truncate">{p.name}</div>
            {p.date && (
              <div className="text-[11.5px] text-[#9aa69e] font-mono">
                {new Date(p.date).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" })}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
