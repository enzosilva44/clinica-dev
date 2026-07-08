import { useMemo, useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

// UI mobile da Agenda — fiel ao protótipo Iasoclin Mobile.
// Consome os MESMOS eventos já carregados pela página Agenda (props); não
// duplica lógica de negócio (loads/submit vivem no componente pai).

const CATS = [
  { key: "all",        label: "Tudo" },
  { key: "consulta",   label: "Consultas" },
  { key: "retorno",    label: "Retornos" },
  { key: "lembrete",   label: "Lembretes" },
  { key: "bloqueio",   label: "Bloqueios" },
];

const CAT_STYLE = {
  consulta:   { bg: "#E7F6EF", border: "#00704A", text: "#006241" },
  retorno:    { bg: "#EAF1F7", border: "#4A8EC2", text: "#2E5A7D" },
  lembrete:   { bg: "#FAF0E4", border: "#C4895A", text: "#A86E43" },
  compromisso:{ bg: "#F3EEFB", border: "#7C53C9", text: "#4A3568" },
  bloqueio:   { bg: "#EDEAE5", border: "#9aa69e", text: "#6f7d74" },
  receivable: { bg: "#E7F6EF", border: "#1E9E5A", text: "#006241" },
  payable:    { bg: "#FAF0E4", border: "#C2473C", text: "#A86E43" },
};

const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtHM(d) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
function durationMin(start, end) {
  if (!start || !end) return null;
  const m = Math.round((new Date(end) - new Date(start)) / 60000);
  return m > 0 ? m : null;
}

export default function AgendaMobile({ events = [], onNewAppointment, onEventClick }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [cat, setCat] = useState("all");

  // Faixa de 7 dias começando 2 dias antes de hoje (rolável).
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + (i - 2));
      return d;
    });
  }, []);

  // Eventos do dia selecionado, filtrados por categoria, ordenados por hora.
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.start && sameDay(new Date(e.start), selectedDate))
      .filter((e) => {
        if (cat === "all") return true;
        return (e.extendedProps?.category || "consulta") === cat;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [events, selectedDate, cat]);

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      {/* header */}
      <div className="flex-1 overflow-y-auto px-[18px] pt-5 pb-24">
        <div className="flex justify-between items-center mb-3.5">
          <h1 className="font-serif font-light text-[26px] text-[#0A3326] m-0">Agenda</h1>
          <button
            className="bg-white border-[1.5px] border-[#E5D8C5] rounded-[10px] px-3 py-2 text-xs font-bold text-[#6f7d74] inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal size={13} /> Filtros
          </button>
        </div>

        {/* seletor de dias */}
        <div className="flex gap-2 overflow-x-auto -mx-[18px] mb-4 px-[18px] pb-1.5 pt-0.5">
          {days.map((d) => {
            const active = sameDay(d, selectedDate);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className="flex-shrink-0 w-[52px] text-center py-[9px] rounded-[13px] transition"
                style={
                  active
                    ? { background: "#00704A", color: "#fff", boxShadow: "0 4px 12px rgba(0,112,74,.3)" }
                    : { background: "#fff", border: "1px solid #ECE2D2" }
                }
              >
                <div className="text-[9.5px] font-bold" style={{ color: active ? "rgba(255,255,255,.75)" : "#a3aea7" }}>
                  {DOW[d.getDay()]}
                </div>
                <div className="text-base font-extrabold mt-0.5" style={{ color: active ? "#fff" : "#0A3326" }}>
                  {d.getDate()}
                </div>
              </button>
            );
          })}
        </div>

        {/* categorias */}
        <div className="flex gap-1.5 overflow-x-auto -mx-[18px] mb-[18px] px-[18px] pb-1">
          {CATS.map((c) => {
            const on = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="flex-shrink-0 rounded-full px-[13px] py-1.5 text-[11.5px] transition"
                style={
                  on
                    ? { background: "#00704A", color: "#fff", fontWeight: 700 }
                    : { background: "#fff", border: "1px solid #ECE2D2", color: "#6f7d74", fontWeight: 600 }
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* timeline do dia */}
        {dayEvents.length === 0 ? (
          <div className="text-center text-[#9aa69e] text-sm py-16">
            Nenhum agendamento neste dia.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dayEvents.map((e) => {
              const start = new Date(e.start);
              const catKey = e.extendedProps?.category || "consulta";
              const s = CAT_STYLE[catKey] || CAT_STYLE.consulta;
              const dur = durationMin(e.start, e.end);
              const { patientName, professional, status } = e.extendedProps || {};
              return (
                <div key={e.id} className="flex gap-3">
                  <div className="w-11 flex-shrink-0 text-right font-mono text-[11px] text-[#9aa69e] pt-3">
                    {fmtHM(start)}
                  </div>
                  <button
                    onClick={() => onEventClick?.(e)}
                    className="flex-1 text-left rounded-[12px] px-3.5 py-3"
                    style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-[13.5px] font-bold" style={{ color: s.text }}>
                        {e.title}{patientName ? ` · ${patientName}` : ""}
                      </div>
                      {dur && (
                        <span className="flex-shrink-0 bg-white rounded-[6px] px-[7px] py-0.5 text-[9.5px] font-bold" style={{ color: s.text }}>
                          {dur} min
                        </span>
                      )}
                    </div>
                    {(professional || status) && (
                      <div className="text-[11.5px] mt-[3px] opacity-80" style={{ color: s.text }}>
                        {[professional, status].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB novo agendamento */}
      <button
        onClick={onNewAppointment}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#00704A] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,112,74,.4)] z-30"
        aria-label="Novo agendamento"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
