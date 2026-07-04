import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const PROFESSIONALS = [
  { name: "Dra Ana",    color: "#00704A" },
  { name: "Dra Julia",  color: "#6F7F73" },
  { name: "Dra Camila", color: "#C4895A" },
];

const DAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const nextM = month === 11 ? 0 : month + 1;
  const nextY = month === 11 ? year + 1 : year;

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrevMonth - i, month: prevM, year: prevY, current: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month, year, current: true });
  for (let d = 1; cells.length < 42; d++)
    cells.push({ day: d, month: nextM, year: nextY, current: false });

  return cells;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MiniCalendar({ allEvents, gotoDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDays = new Set(
    allEvents.map((e) => {
      const d = new Date(e.start);
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    })
  );

  const cells = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div className="bg-creme-50 border border-creme-200 rounded-2xl p-3.5">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-creme-100 text-verde transition"
        >
          <ChevronLeft size={13} />
        </button>
        <span className="text-xs font-semibold text-verde">
          {MONTHS_PT[viewMonth].slice(0, 3)} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-creme-100 text-verde transition"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_PT.map((d, i) => (
          <div key={i} className="text-center text-[0.58rem] font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, i) => {
          const key = dateKey(cell.year, cell.month, cell.day);
          const isToday = key === todayKey;
          const hasEvent = eventDays.has(key);
          return (
            <button
              key={i}
              onClick={() => gotoDate?.(new Date(cell.year, cell.month, cell.day))}
              className={`relative flex flex-col items-center justify-center h-7 rounded-lg transition ${
                isToday
                  ? "bg-verde text-white"
                  : cell.current
                  ? "hover:bg-creme-100 text-verde"
                  : "text-gray-300 hover:bg-creme-100"
              }`}
            >
              <span className="text-[0.62rem] font-medium leading-none">{cell.day}</span>
              {hasEvent && (
                <span
                  className="absolute bottom-0.5 w-1 h-1 rounded-full"
                  style={{ backgroundColor: isToday ? "rgba(255,255,255,0.7)" : "#00704A", opacity: isToday ? 1 : 0.45 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarSidebar({ selectedProfessionals, toggleProfessional, allEvents = [], gotoDate }) {
  const showProfessionals = !!selectedProfessionals && !!toggleProfessional;
  const allSelected = showProfessionals && PROFESSIONALS.every((p) => selectedProfessionals.includes(p.name));
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("agendaSidebarCollapsed") === "1"
  );

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("agendaSidebarCollapsed", next ? "1" : "0");
      return next;
    });
  }

  // Recolhida: faixa fina só com o botão de expandir, devolvendo espaço à agenda.
  if (collapsed) {
    return (
      <div className="w-10 shrink-0 flex flex-col items-center pt-1">
        <button
          onClick={toggleCollapsed}
          title="Expandir painel"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-creme-50 border border-creme-200 text-verde hover:bg-creme-100 transition"
        >
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  function toggleAll() {
    if (allSelected) {
      PROFESSIONALS.forEach((p) => {
        if (selectedProfessionals.includes(p.name)) toggleProfessional(p.name);
      });
    } else {
      PROFESSIONALS.forEach((p) => {
        if (!selectedProfessionals.includes(p.name)) toggleProfessional(p.name);
      });
    }
  }

  return (
    <div className="w-52 shrink-0 flex flex-col gap-5">
      {/* Botão de recolher o painel */}
      <div className="flex justify-end -mb-3">
        <button
          onClick={toggleCollapsed}
          title="Recolher painel"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-verde hover:bg-creme-100 transition"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Mini calendar */}
      <MiniCalendar allEvents={allEvents} gotoDate={gotoDate} />

      {/* Profissionais — só exibe no plano dev */}
      {showProfessionals && (
        <div className="bg-creme-50 border border-creme-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Profissionais
            </p>
            <button
              onClick={toggleAll}
              className="text-xs text-verde hover:opacity-70 transition font-medium"
            >
              {allSelected ? "Limpar" : "Todos"}
            </button>
          </div>

          <div className="space-y-1.5">
            {PROFESSIONALS.map((p) => {
              const active = selectedProfessionals.includes(p.name);
              return (
                <button
                  key={p.name}
                  onClick={() => toggleProfessional(p.name)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition text-left ${
                    active
                      ? "bg-white border border-creme-200 shadow-sm"
                      : "hover:bg-creme-100 opacity-45 hover:opacity-70"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm font-medium text-verde flex-1 truncate">
                    {p.name}
                  </span>
                  {active && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda de status */}
      <div className="bg-creme-50 border border-creme-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Status
        </p>
        <div className="space-y-2">
          {[
            { label: "Agendado",       color: "#C4895A" },
            { label: "Confirmado",     color: "#4A8EC2" },
            { label: "Em atendimento", color: "#D4A017" },
            { label: "Concluído",      color: "#3A9B6F" },
            { label: "Cancelado",      color: "#B05248" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
