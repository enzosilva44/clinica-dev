import { useState } from "react";
import { Plus, ArrowUp, ArrowDown } from "lucide-react";

// UI mobile do Financeiro — fiel ao protótipo Iasoclin Mobile.
// Recebe dados já carregados por Financeiro.jsx via props (sem duplicar loads).
// Foca na aba Resumo; abas de detalhe caem no fluxo desktop por ora.

const TABS = ["Resumo", "Lançamentos", "Extrato", "✦ Guardião"];

export default function FinanceiroMobile({
  summary = {},
  lancamentos = [],
  guardian,
  monthLabel,
  fmt = (v) => v,
  onNew,
}) {
  const [tab, setTab] = useState("Resumo");

  const receitas = summary.receitas ?? 0;
  const despesas = summary.despesas ?? 0;
  const saldo = summary.saldo ?? receitas - despesas;
  const margem = receitas > 0 ? Math.round((saldo / receitas) * 1000) / 10 : null;

  const guardianMsg =
    guardian?.alerts?.[0]?.message ||
    guardian?.summary ||
    "Sem alertas do Guardião no momento.";

  // Lançamentos recentes (até 6) para a lista "Hoje/Recentes".
  const recent = [...lancamentos].slice(0, 6);

  return (
    <div className="px-[18px] pt-5 pb-6 bg-[#FAF7F2] min-h-full">
      {/* header */}
      <div className="flex justify-between items-center mb-3.5">
        <h1 className="font-serif font-light text-[26px] m-0 text-[#0A3326]">Financeiro</h1>
        <span className="text-[11.5px] text-[#9aa69e] font-mono uppercase">{monthLabel}</span>
      </div>

      {/* abas */}
      <div className="flex gap-1 overflow-x-auto -mx-[18px] mb-4 px-[18px] pb-1">
        {TABS.map((t) => {
          const on = tab === t;
          const guardiao = t.startsWith("✦");
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-shrink-0 rounded-full px-3.5 py-[7px] text-[11.5px] transition"
              style={
                on && guardiao
                  ? { background: "#F3EEFB", border: "1px solid #DCCBF5", color: "#7C53C9", fontWeight: 700 }
                  : on
                  ? { background: "#00704A", color: "#fff", fontWeight: 700 }
                  : guardiao
                  ? { background: "#F3EEFB", border: "1px solid #DCCBF5", color: "#7C53C9", fontWeight: 700 }
                  : { background: "#fff", border: "1px solid #ECE2D2", color: "#6f7d74", fontWeight: 600 }
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "Resumo" || tab === "✦ Guardião" ? (
        <>
          {/* hero lucro líquido */}
          <div className="bg-[#06251B] rounded-[18px] p-5 mb-3 relative overflow-hidden">
            <div className="text-[10.5px] font-bold tracking-[.1em] text-[#A9DEC8] uppercase font-mono">
              Lucro líquido · {monthLabel?.toLowerCase()}
            </div>
            <div className="font-serif font-light text-[42px] text-white mt-1.5 tracking-[-.01em]">
              {fmt(saldo)}
            </div>
            {margem != null && (
              <div className="text-xs text-[#A9DEC8] mt-1">margem de {margem}%</div>
            )}
          </div>

          {/* receita / despesa */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-white border border-[#ECE2D2] rounded-[14px] p-3.5">
              <div className="text-[10px] font-bold tracking-[.06em] text-[#a3aea7] uppercase">Receita</div>
              <div className="text-[19px] font-extrabold mt-1 font-mono text-[#00704A]">{fmt(receitas)}</div>
            </div>
            <div className="bg-white border border-[#ECE2D2] rounded-[14px] p-3.5">
              <div className="text-[10px] font-bold tracking-[.06em] text-[#a3aea7] uppercase">Despesa</div>
              <div className="text-[19px] font-extrabold mt-1 font-mono text-[#C4895A]">{fmt(despesas)}</div>
            </div>
          </div>

          {/* lançamentos recentes */}
          <div className="flex justify-between items-baseline mb-2.5">
            <div className="text-[13.5px] font-bold text-[#0A3326]">Recentes</div>
            {summary.pendentes != null && (
              <div className="text-[11.5px] text-[#9aa69e] font-mono">pendente {fmt(summary.pendentes)}</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {recent.length === 0 ? (
              <div className="bg-white border border-[#ECE2D2] rounded-[13px] py-6 text-center text-sm text-[#9aa69e]">
                Sem lançamentos.
              </div>
            ) : (
              recent.map((l) => {
                const receita = l.type === "receita";
                return (
                  <div key={l.id} className="bg-white border border-[#ECE2D2] rounded-[13px] px-3.5 py-3 flex items-center gap-3">
                    <div
                      className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ background: receita ? "#E7F6EF" : "#FAF0E4" }}
                    >
                      {receita ? <ArrowUp size={15} color="#00704A" /> : <ArrowDown size={15} color="#C4895A" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold truncate text-[#0A3326]">{l.description || "Lançamento"}</div>
                      <div className="text-[11px] text-[#9aa69e] truncate">
                        {[l.category, l.status].filter(Boolean).join(" · ") || (receita ? "Receita" : "Despesa")}
                      </div>
                    </div>
                    <div className="font-mono text-[13px] font-bold shrink-0" style={{ color: receita ? "#00704A" : "#C4895A" }}>
                      {receita ? "+" : "−"}{fmt(Math.abs(l.amount ?? 0)).replace("R$", "").trim()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* guardião */}
          <div className="mt-4 bg-[#F3EEFB] border border-[#DCCBF5] rounded-[14px] p-3.5">
            <div className="text-[11px] font-bold text-[#7C53C9] font-mono tracking-[.06em] mb-1.5">✦ GUARDIÃO IA</div>
            <div className="text-[12.5px] text-[#4A3568] leading-[1.55]">{guardianMsg}</div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-[#ECE2D2] rounded-[14px] p-6 text-center text-sm text-[#6f7d74]">
          Esta aba segue o padrão do desktop. Abra no computador para a visão completa de {tab.toLowerCase()}.
        </div>
      )}

      {/* FAB novo lançamento */}
      <button
        onClick={onNew}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#00704A] text-white flex items-center justify-center shadow-[0_8px_22px_rgba(0,112,74,.4)] z-30"
        aria-label="Novo lançamento"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
