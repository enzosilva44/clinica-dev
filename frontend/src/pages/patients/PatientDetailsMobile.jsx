import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import PatientPhotos from "../../components/patient/PatientPhotos";
import { fmtDateOnly } from "../../utils/date";

// UI mobile do detalhe do paciente — fiel ao protótipo Iasoclin Mobile.
// Recebe patient/stats já carregados por PatientDetails.jsx via props.
// Reusa o componente PatientPhotos existente na aba Fotos.

function initials(name) {
  return (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function money(v) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TABS = ["Fotos", "Resumo", "Clínico", "Documentos", "Orçamentos", "Agendamentos", "Timeline"];

export default function PatientDetailsMobile({ id, patient, patientStats, aiSummary, onEdit }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Fotos");

  const phone = patient?.phone;
  const age = patientStats?.birthday?.age;
  const topProcedures = patientStats?.topProcedures ?? [];
  const maxCount = topProcedures[0]?.count || 1;

  return (
    <div className="pb-6 bg-[#FAF7F2] min-h-full">
      {/* header verde escuro */}
      <div className="bg-[#06251B] px-[18px] pt-[18px] pb-5 text-white">
        <button
          onClick={() => navigate("/patients")}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#A9DEC8] font-semibold mb-3.5"
        >
          <ChevronLeft size={15} /> Pacientes
        </button>
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-[#A9DEC8] text-[#06251B] flex items-center justify-center text-lg font-bold shrink-0">
            {initials(patient?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif font-light text-[22px] truncate">{patient?.name || "Paciente"}</div>
            <div className="text-xs text-white/60 mt-0.5 truncate">
              {[phone, age ? `${age} anos` : null].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button
            onClick={onEdit}
            className="bg-white/10 border border-white/20 text-white rounded-[9px] px-3 py-2 text-[11.5px] font-bold shrink-0"
          >
            Editar
          </button>
        </div>
        {aiSummary && (
          <div className="mt-3.5 bg-[#A9DEC8]/[.12] border border-[#A9DEC8]/25 rounded-[11px] px-3 py-2.5 text-[11.5px] leading-[1.55] text-[#A9DEC8]">
            ✦ {aiSummary}
          </div>
        )}
      </div>

      {/* abas horizontais */}
      <div className="flex gap-1 overflow-x-auto px-[18px] py-3 bg-white border-b border-[#ECE2D2] sticky top-0 z-10">
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-shrink-0 rounded-full px-3.5 py-[7px] text-[11.5px] font-bold transition"
              style={
                on
                  ? { background: "#00704A", color: "#fff", border: "1px solid #00704A" }
                  : { background: "#FAF7F2", color: "#6f7d74", border: "1px solid #ECE2D2" }
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* FOTOS */}
      {tab === "Fotos" && (
        <div className="p-[18px]">
          <PatientPhotos patientId={id} />
        </div>
      )}

      {/* RESUMO */}
      {tab === "Resumo" && (
        <div className="p-[18px]">
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <StatCard label="Consultas" value={patientStats?.totalAppointments ?? "—"} />
            <StatCard label="Cliente há" value={patientStats?.clientSince?.label ?? "—"} />
            <StatCard label="Total gasto" value={money(patientStats?.totalSpent)} mono accent />
            <StatCard label="Mais feito" value={topProcedures[0]?.name ?? "—"} small />
          </div>

          <div className="bg-white border border-[#ECE2D2] rounded-[14px] p-4">
            <div className="text-[13px] font-bold mb-3 text-[#0A3326]">Procedimentos</div>
            {topProcedures.length === 0 ? (
              <div className="text-sm text-[#9aa69e]">Sem procedimentos registrados.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {topProcedures.map((p, i) => {
                  const pct = Math.max(8, Math.round((p.count / maxCount) * 100));
                  const color = i === 0 ? "#00704A" : i === 1 ? "#46AE85" : "#A9DEC8";
                  return (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[#0A3326]">{p.name}</span>
                        <span className="text-[#9aa69e]">{p.count}×</span>
                      </div>
                      <div className="h-[5px] rounded-[3px] bg-[#EFE7DA]">
                        <div className="h-[5px] rounded-[3px]" style={{ background: color, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* demais abas: placeholder honesto (fluxo completo no desktop) */}
      {tab !== "Fotos" && tab !== "Resumo" && (
        <div className="px-[18px] py-10 text-center text-[13px] text-[#6f7d74] leading-[1.6]">
          Esta aba tem a visão completa no computador.<br />No celular priorizamos Fotos e Resumo.
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, mono, accent, small }) {
  return (
    <div className="bg-white border border-[#ECE2D2] rounded-[14px] p-3.5">
      <div className="text-[10px] font-bold tracking-[.06em] text-[#a3aea7] uppercase">{label}</div>
      <div
        className={`mt-1 font-extrabold text-[#0A3326] ${small ? "text-[13px] mt-2" : accent ? "text-[20px] mt-1.5" : "text-[24px]"} ${mono ? "font-mono" : ""}`}
        style={accent ? { color: "#00704A" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
