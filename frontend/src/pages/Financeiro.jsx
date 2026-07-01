import { useEffect, useState, useCallback } from "react";
import {
  Plus, X, TrendingUp, TrendingDown, DollarSign, Clock,
  CheckCircle2, Filter, CalendarDays, FileText, Layers,
  Wallet, AlertTriangle, Repeat2, Pencil, Download,
  ShieldCheck, ShieldAlert, RefreshCw, Info, Sparkles, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import toast from "react-hot-toast";
import { notify } from "../lib/tomDeVoz";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

// ─── constantes ──────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"];
const CATEGORIES = ["Procedimento", "Aluguel", "Fornecedor", "Salário", "Imposto", "Marketing", "Equipamento", "Outros"];

const CAT_COLORS = {
  Procedimento: "#00704A", Aluguel: "#6F7F73", Fornecedor: "#C4895A",
  Salário: "#0A3326", Imposto: "#9b6b3a", Marketing: "#4a7c74",
  Equipamento: "#8a6a3d", Faturamento: "#7C3AED", Outros: "#9ca3af",
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(v) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtDateGroup(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function daysDiff(d) {
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

function downloadCSV(rows, filename) {
  const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Forma de Pagamento", "Saldo"];
  const lines = [header, ...rows.map((r) => [
    fmtDate(r.paidAt || r.createdAt),
    r.description,
    r.category || "",
    r.type === "receita" ? "Receita" : "Despesa",
    (r.type === "receita" ? "+" : "-") + (r.amount ?? 0).toFixed(2).replace(".", ","),
    r.paymentMethod || "",
    (r.balance ?? 0).toFixed(2).replace(".", ","),
  ])];
  const csv = lines.map((l) => l.map((v) => `"${v}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const INPUT = "w-full border border-[#C4895A] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20";

const STATUS_PILL = {
  pendente:   "bg-amber-100 text-amber-700",
  confirmado: "bg-emerald-100 text-emerald-700",
  cancelado:  "bg-gray-100 text-gray-500",
};

const TABS = [
  { id: "resumo",      label: "Resumo" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "extrato",     label: "Extrato" },
  { id: "guardiao",    label: "Guardião IA" },
];

// ─── tooltip customizado para o gráfico ──────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5D8C5] rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#00704A] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────

function Empty({ icon: Icon, text, sub }) {
  return (
    <div className="flex flex-col items-center py-20 text-center text-gray-400">
      <Icon size={40} className="mb-3 opacity-30" />
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─── delta badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

// ─── helper: resolve paciente da transação ────────────────────────────────────

function resolvePatient(tx) {
  return tx.patient || tx.appointment?.patient || tx.budget?.patient;
}

// ─── referência de vínculo ────────────────────────────────────────────────────

function TxRef({ tx }) {
  const patient = resolvePatient(tx);
  const hasInstallment = tx.installments > 1;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {patient && (
        <span className="text-xs text-[#6F7F73] font-medium">{patient.name}</span>
      )}
      {tx.appointment && (
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <CalendarDays size={10} className="shrink-0" />
          {tx.appointment.title || tx.appointment.procedureType || "Agendamento"}
          {tx.appointment.startsAt && <> · {new Date(tx.appointment.startsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>}
        </span>
      )}
      {tx.budget && (
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <FileText size={10} className="shrink-0" />
          {tx.budget.title}
          {tx.budget.total && <> · {fmt(tx.budget.total)}</>}
        </span>
      )}
      {hasInstallment && (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
          <Layers size={10} />
          Parcela {tx.installmentNumber}/{tx.installments}
        </span>
      )}
    </div>
  );
}

// ─── modal de lançamento (criar / editar) ─────────────────────────────────────

function TransactionModal({ initial, onClose, onSave }) {
  const isEdit = !!initial?.id;

  const [form, setForm] = useState({
    type: "receita", description: "", amount: "", category: "",
    paymentMethod: "", dueDate: "", patientId: "",
    isRecurring: false, recurringDay: "",
    appointmentId: "", budgetId: "", notes: "",
    ...initial,
    amount: initial?.amount ?? "",
    dueDate: initial?.dueDate ? String(initial.dueDate).slice(0, 10) : "",
  });

  // combobox paciente
  const [patientSearch, setPatientSearch] = useState(initial?.patient?.name || "");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [selectedPatientName, setSelectedPatientName] = useState(initial?.patient?.name || "");

  const [installmentsOn, setInstallmentsOn] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [patientBudgets, setPatientBudgets] = useState([]);

  // busca pacientes ao digitar
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/patients", { params: { search: patientSearch, page: 1 } });
        setPatientResults(r.data?.data || r.data?.patients || []);
      } catch { setPatientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  // carrega agendamentos e orçamentos ao selecionar paciente
  useEffect(() => {
    if (!form.patientId) { setPatientAppointments([]); setPatientBudgets([]); return; }
    Promise.all([
      api.get(`/appointments/patient/${form.patientId}`).catch(() => ({ data: [] })),
      api.get(`/budgets/patient/${form.patientId}`).catch(() => ({ data: [] })),
    ]).then(([appts, bgets]) => {
      setPatientAppointments(appts.data || []);
      setPatientBudgets(bgets.data || []);
    });
  }, [form.patientId]);

  function selectPatient(p) {
    setForm((prev) => ({ ...prev, patientId: p.id, appointmentId: "", budgetId: "" }));
    setSelectedPatientName(p.name);
    setPatientSearch(p.name);
    setPatientResults([]);
    setShowPatientDrop(false);
  }

  function clearPatient() {
    setForm((prev) => ({ ...prev, patientId: "", appointmentId: "", budgetId: "" }));
    setSelectedPatientName("");
    setPatientSearch("");
    setPatientAppointments([]);
    setPatientBudgets([]);
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fb = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return toast.error("Preencha descrição e valor");
    const payload = {
      ...form,
      installments: installmentsOn ? Number(installmentCount) : 1,
    };
    await onSave(payload, isEdit ? initial.id : null);
  }

  const hasVinculo = patientAppointments.length > 0 || patientBudgets.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#00704A]">
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* tipo */}
          <div className="flex rounded-xl border border-[#C4895A] overflow-hidden">
            {[{ v: "receita", l: "Receita", c: "bg-emerald-500" }, { v: "despesa", l: "Despesa", c: "bg-red-500" }].map(({ v, l, c }) => (
              <button key={v} type="button" onClick={() => setForm((p) => ({ ...p, type: v }))}
                className={`flex-1 py-2.5 text-sm font-medium transition ${form.type === v ? `${c} text-white` : "bg-white text-gray-500 hover:bg-[#FAF7F2]"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* descrição + valor */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descrição *</label>
            <input value={form.description} onChange={f("description")} placeholder="Ex: Consulta, Aluguel…" required className={INPUT} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Valor total (R$) *</label>
              <input value={form.amount} onChange={f("amount")} type="number" min="0" step="0.01" placeholder="0,00" required className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
              <select value={form.category ?? ""} onChange={f("category")} className={INPUT}>
                <option value="">Selecione</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Forma de pagamento</label>
              <select value={form.paymentMethod ?? ""} onChange={f("paymentMethod")} className={INPUT}>
                <option value="">Selecione</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{installmentsOn ? "Data 1ª parcela" : "Data de vencimento"}</label>
              <input value={form.dueDate} onChange={f("dueDate")} type="date" className={INPUT} />
            </div>
          </div>

          {/* paciente combobox */}
          <div className="relative">
            <label className="text-xs text-gray-500 mb-1 block">Paciente (opcional)</label>
            <div className="flex gap-2">
              <input
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
                onFocus={() => patientSearch.length >= 2 && setShowPatientDrop(true)}
                onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
                placeholder="Buscar paciente..."
                className={INPUT}
                autoComplete="off"
              />
              {form.patientId && (
                <button type="button" onClick={clearPatient}
                  className="border border-[#C4895A] rounded-xl px-3 text-gray-400 hover:text-red-400 hover:border-red-300 transition">
                  <X size={16} />
                </button>
              )}
            </div>
            {showPatientDrop && patientResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-[#E5D8C5] rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                {patientResults.map((p) => (
                  <button key={p.id} type="button" onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF7F2] text-[#00704A]">
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* vínculo: agendamento ou orçamento */}
          {hasVinculo && (
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#00704A] uppercase tracking-wide">Vincular a</p>
              {patientAppointments.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                    <CalendarDays size={11} /> Agendamento
                  </label>
                  <select value={form.appointmentId || ""} onChange={(e) => setForm((p) => ({ ...p, appointmentId: e.target.value, budgetId: "" }))} className={INPUT}>
                    <option value="">Nenhum</option>
                    {patientAppointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title || a.procedureType || "Agendamento"} · {new Date(a.startsAt).toLocaleDateString("pt-BR")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {patientBudgets.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                    <FileText size={11} /> Orçamento
                  </label>
                  <select value={form.budgetId || ""} onChange={(e) => setForm((p) => ({ ...p, budgetId: e.target.value, appointmentId: "" }))} className={INPUT}>
                    <option value="">Nenhum</option>
                    {patientBudgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} · {fmt(b.total)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* parcelamento */}
          {!isEdit && (
            <div className="border border-[#E5D8C5] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="installments" checked={installmentsOn}
                  onChange={(e) => setInstallmentsOn(e.target.checked)}
                  className="w-4 h-4 accent-[#00704A]" />
                <label htmlFor="installments" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-500" /> Parcelar pagamento
                </label>
              </div>
              {installmentsOn && (
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Número de parcelas</label>
                    <input value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)}
                      type="number" min="2" max="60" className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm w-24" />
                  </div>
                  {form.amount && installmentCount && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400">Valor por parcela</p>
                      <p className="text-sm font-bold text-indigo-600">
                        {fmt(Number(form.amount) / Number(installmentCount))}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {installmentsOn && (
                <p className="text-[11px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2">
                  Serão criadas {installmentCount} transações pendentes, com vencimento mensal a partir da data informada.
                </p>
              )}
            </div>
          )}

          {/* observação */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Observação</label>
            <textarea value={form.notes || ""} onChange={f("notes")} rows={2}
              placeholder="Anotações internas sobre este lançamento..."
              className={INPUT + " resize-none"} />
          </div>

          {/* recorrência */}
          {!installmentsOn && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="recurring" checked={!!form.isRecurring} onChange={fb("isRecurring")}
                className="w-4 h-4 accent-[#00704A]" />
              <label htmlFor="recurring" className="text-sm text-gray-600 flex items-center gap-1.5">
                <Repeat2 size={14} className="text-[#6F7F73]" /> Lançamento recorrente
              </label>
              {form.isRecurring && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-gray-500">Dia</span>
                  <input value={form.recurringDay} onChange={f("recurringDay")} type="number" min="1" max="31"
                    placeholder="1–31" className="border border-[#C4895A] rounded-lg px-2 py-1.5 text-sm w-16" />
                  <span className="text-xs text-gray-500">do mês</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#C4895A] text-[#00704A] py-2.5 rounded-xl text-sm hover:bg-[#EFE7DA] transition">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 bg-[#00704A] hover:bg-[#0A3326] text-white py-2.5 rounded-xl text-sm font-medium transition">
              {isEdit ? "Salvar" : installmentsOn ? `Criar ${installmentCount} parcelas` : "Criar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── guardião ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critico: {
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    icon: ShieldAlert,
    iconColor: "text-red-500",
    label: "Crítico",
  },
  alerta: {
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    label: "Alerta",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    icon: Info,
    iconColor: "text-blue-500",
    label: "Info",
  },
};

function ScoreRing({ score }) {
  const color = score >= 80 ? "#3A9B6F" : score >= 50 ? "#C4895A" : "#B05248";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#EFE7DA" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400 font-medium">score</span>
      </div>
    </div>
  );
}

function GuardianTab({ data, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#00704A] flex items-center justify-center animate-pulse">
          <Sparkles size={20} className="text-[#C4895A]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#00704A]">Analisando fluxo financeiro…</p>
          <p className="text-xs text-gray-400 mt-1">A IA está verificando padrões e inconsistências</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[#FAF7F2] border border-[#E5D8C5] flex items-center justify-center">
          <ShieldCheck size={28} className="text-[#00704A]" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-[#00704A]">Guardião Financeiro</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            A IA analisa duplicidades, inadimplências e inconsistências no seu fluxo financeiro.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="bg-[#00704A] hover:bg-[#0A3326] text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition"
        >
          <Sparkles size={15} /> Analisar agora
        </button>
      </div>
    );
  }

  const criticos = data.alerts?.filter((a) => a.severity === "critico") ?? [];
  const alertas = data.alerts?.filter((a) => a.severity === "alerta") ?? [];
  const infos = data.alerts?.filter((a) => a.severity === "info") ?? [];
  const allAlerts = [...criticos, ...alertas, ...infos];

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5 flex items-center gap-5">
        <ScoreRing score={data.score ?? 0} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-[#00704A] shrink-0" />
            <p className="text-sm font-bold text-[#00704A]">Saúde Financeira</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{data.resumo}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {criticos.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
                {criticos.length} crítico{criticos.length > 1 ? "s" : ""}
              </span>
            )}
            {alertas.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                {alertas.length} alerta{alertas.length > 1 ? "s" : ""}
              </span>
            )}
            {infos.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
                {infos.length} info
              </span>
            )}
            {allAlerts.length === 0 && (
              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                Tudo ok
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 w-9 h-9 rounded-xl border border-[#E5D8C5] hover:bg-[#FAF7F2] flex items-center justify-center transition text-gray-400 hover:text-[#00704A]"
          title="Reanalisar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Alerts */}
      {allAlerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
          <ShieldCheck size={32} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-700">Nenhum problema encontrado</p>
            <p className="text-xs text-green-600 mt-0.5">O fluxo financeiro está consistente com os registros de agendamentos e orçamentos.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {allAlerts.map((alert, i) => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`border rounded-2xl p-5 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={18} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">{alert.tipo}</span>
                      {alert.valorEmRisco > 0 && (
                        <span className="text-[10px] font-bold text-gray-600 ml-auto">
                          {fmt(alert.valorEmRisco)} em risco
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-800 mb-1">{alert.titulo}</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{alert.descricao}</p>
                    {alert.pacientes?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {alert.pacientes.map((p, j) => (
                          <span key={j} className="text-[11px] bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {alert.acaoSugerida && (
                      <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-gray-200/60">
                        <CheckCircle2 size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-500 leading-relaxed">{alert.acaoSugerida}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function Financeiro() {
  const [tab, setTab] = useState("resumo");

  // dados
  const [summary, setSummary] = useState({ receitas: 0, despesas: 0, saldo: 0, pendentes: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [extrato, setExtrato] = useState([]);

  // loading
  const [loadingSum, setLoadingSum] = useState(true);
  const [loadingAna, setLoadingAna] = useState(false);
  const [loadingLanc, setLoadingLanc] = useState(false);
  const [loadingExt, setLoadingExt] = useState(false);

  // filtros
  const [month, setMonth] = useState(currentMonth());
  const [lancMonth, setLancMonth] = useState(currentMonth());
  const [lancType, setLancType] = useState("");
  const [lancStatus, setLancStatus] = useState("");
  const [lancCat, setLancCat] = useState("");
  const [extStart, setExtStart] = useState("");
  const [extEnd, setExtEnd] = useState("");
  const [extType, setExtType] = useState("");
  const [extMethod, setExtMethod] = useState("");

  // guardião
  const [guardian, setGuardian] = useState(null);
  const [loadingGuardian, setLoadingGuardian] = useState(false);

  // modal
  const [modalData, setModalData] = useState(null); // null = fechado, {} = criar, {id,...} = editar
  const [approvingId, setApprovingId] = useState(null);
  const [approveForm, setApproveForm] = useState({ amount: "", method: "" });

  // ── loaders ────────────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setLoadingSum(true);
    try {
      const r = await api.get("/financial/summary", { params: { month } });
      setSummary(r.data);
    } catch { notify.erro(null, "carregar o resumo"); }
    finally { setLoadingSum(false); }
  }, [month]);

  const loadAnalytics = useCallback(async () => {
    setLoadingAna(true);
    try {
      const [ana, upco] = await Promise.all([
        api.get("/financial/analytics", { params: { month } }),
        api.get("/financial/upcoming"),
      ]);
      setAnalytics(ana.data);
      setUpcoming(upco.data);
    } catch { notify.erro(null, "carregar os indicadores"); }
    finally { setLoadingAna(false); }
  }, [month]);

  const loadLancamentos = useCallback(async () => {
    setLoadingLanc(true);
    try {
      const r = await api.get("/financial", {
        params: {
          month: lancMonth || undefined,
          type: lancType || undefined,
          status: lancStatus || undefined,
          category: lancCat || undefined,
        },
      });
      setLancamentos(r.data);
    } catch { notify.erro(null, "carregar os lançamentos"); }
    finally { setLoadingLanc(false); }
  }, [lancMonth, lancType, lancStatus, lancCat]);

  const loadExtrato = useCallback(async () => {
    setLoadingExt(true);
    try {
      const r = await api.get("/financial", {
        params: {
          startDate: extStart || undefined,
          endDate: extEnd || undefined,
          type: extType || undefined,
          paymentMethod: extMethod || undefined,
          status: "confirmado",
        },
      });
      // calcular saldo corrente
      const sorted = [...r.data].sort((a, b) => new Date(a.paidAt || a.createdAt) - new Date(b.paidAt || b.createdAt));
      let balance = 0;
      const withBalance = sorted.map((t) => {
        balance += t.type === "receita" ? t.amount : -t.amount;
        return { ...t, balance };
      });
      setExtrato(withBalance.reverse());
    } catch { notify.erro(null, "carregar o extrato"); }
    finally { setLoadingExt(false); }
  }, [extStart, extEnd, extType, extMethod]);

  const loadGuardian = useCallback(async () => {
    setLoadingGuardian(true);
    try {
      const r = await api.get("/ai/financial-health");
      setGuardian(r.data);
    } catch { notify.erro(null, "analisar a saúde financeira"); }
    finally { setLoadingGuardian(false); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (tab === "resumo") loadAnalytics(); }, [tab, loadAnalytics]);
  useEffect(() => { if (tab === "lancamentos") loadLancamentos(); }, [tab, loadLancamentos]);
  useEffect(() => { if (tab === "extrato") loadExtrato(); }, [tab, loadExtrato]);
  useEffect(() => { if (tab === "guardiao" && !guardian) loadGuardian(); }, [tab, guardian, loadGuardian]);

  // ── criar / editar ─────────────────────────────────────────────────────────

  async function handleSave(form, editId) {
    try {
      if (editId) {
        await api.put(`/financial/${editId}`, form);
        notify.ok("Lançamento atualizado");
      } else {
        await api.post("/financial", form);
        notify.ok("Lançamento criado");
      }
      setModalData(null);
      loadSummary();
      if (tab === "lancamentos") loadLancamentos();
      if (tab === "extrato") loadExtrato();
      if (tab === "resumo") loadAnalytics();
    } catch { notify.erro(null, "salvar o lançamento"); }
  }

  // ── aprovar pendente ────────────────────────────────────────────────────────

  async function handleApprove(id) {
    if (!approveForm.amount) return toast.error("Informe o valor recebido");
    try {
      await api.patch(`/financial/${id}/approve`, { amount: approveForm.amount, paymentMethod: approveForm.method });
      toast.success("Recebimento confirmado!");
      setApprovingId(null);
      loadSummary(); loadAnalytics(); loadLancamentos();
    } catch (err) { toast.error(err.response?.data?.error || "Erro ao aprovar"); }
  }

  async function handleCancel(id) {
    try {
      await api.patch(`/financial/${id}/cancel`);
      toast.success("Transação cancelada");
      loadSummary(); loadLancamentos(); loadAnalytics();
    } catch { toast.error("Erro ao cancelar"); }
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  function handleExportCSV() {
    downloadCSV(extrato, `extrato-${extStart || "inicio"}-${extEnd || "hoje"}.csv`);
  }

  // ── agrupamento por data (extrato) ─────────────────────────────────────────

  const extratoGrouped = (() => {
    const groups = [];
    let lastDate = "";
    for (const tx of extrato) {
      const d = new Date(tx.paidAt || tx.createdAt).toDateString();
      if (d !== lastDate) { groups.push({ type: "header", date: tx.paidAt || tx.createdAt }); lastDate = d; }
      groups.push({ type: "row", tx });
    }
    return groups;
  })();

  // ── totais extrato ──────────────────────────────────────────────────────────

  const extTotals = {
    receitas: extrato.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0),
    despesas: extrato.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0),
  };

  // ── max categorias (para barras) ────────────────────────────────────────────

  const catMax = analytics?.categories?.length
    ? Math.max(...analytics.categories.map((c) => c.receitas + c.despesas))
    : 1;

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#00704A]">Financeiro</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Receitas, despesas e fluxo de caixa</p>
        </div>
        <button
          onClick={() => setModalData({})}
          className="bg-[#00704A] hover:bg-[#0A3326] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition shrink-0"
        >
          <Plus size={16} /> Novo lançamento
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${tab === t.id ? "bg-white text-[#00704A] shadow-sm" : "text-gray-500 hover:text-[#00704A]"}`}>
            {t.label}
            {t.id === "lancamentos" && summary.pendentes > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {summary.pendentes}
              </span>
            )}
            {t.id === "guardiao" && guardian?.alerts?.filter((a) => a.severity === "critico").length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {guardian.alerts.filter((a) => a.severity === "critico").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMO ──────────────────────────────────────────────────────── */}
      {tab === "resumo" && (
        <>
          {/* seletor de mês */}
          <div className="mb-5">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm text-[#00704A]" />
          </div>

          {loadingSum ? <Spinner /> : (
            <>
              {/* KPI CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {/* receitas */}
                <div className="bg-[#00704A] rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-2 opacity-60">
                    <TrendingUp size={15} />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Receitas</p>
                  </div>
                  <p className="text-2xl font-bold">{fmt(summary.receitas)}</p>
                  <DeltaBadge pct={analytics?.comparison?.receitasPct} />
                </div>
                {/* despesas */}
                <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                    <TrendingDown size={15} className="text-red-400" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Despesas</p>
                  </div>
                  <p className="text-2xl font-bold text-red-500">{fmt(summary.despesas)}</p>
                  <DeltaBadge pct={analytics?.comparison?.despesasPct} />
                </div>
                {/* saldo */}
                <div className={`rounded-2xl p-5 ${summary.saldo >= 0 ? "bg-[#0A3326] text-white" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-2 opacity-60">
                    <DollarSign size={15} />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Saldo</p>
                  </div>
                  <p className={`text-2xl font-bold ${summary.saldo < 0 ? "text-red-600" : ""}`}>{fmt(summary.saldo)}</p>
                  <DeltaBadge pct={analytics?.comparison?.saldoPct} />
                </div>
                {/* pendentes */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={15} className="text-amber-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">A receber</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">{summary.pendentes}</p>
                  <p className="text-[11px] text-amber-500 mt-0.5">
                    {summary.pendentes !== 1 ? "transações pendentes" : "transação pendente"}
                  </p>
                </div>
              </div>

              {loadingAna ? null : analytics && (
                <>
                  {/* GRÁFICO SEMANAL */}
                  <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5 mb-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Evolução semanal</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={analytics.weekly} barGap={4} barSize={22}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EFE7DA" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F0EBE0" }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="receitas" name="Receitas" fill="#00704A" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* PROPORÇÃO + CATEGORIAS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    {/* barra de proporção */}
                    <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Proporção do mês</p>
                      {(summary.receitas + summary.despesas) === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Sem dados</p>
                      ) : (
                        <>
                          <div className="h-4 bg-[#EFE7DA] rounded-full overflow-hidden flex mb-2">
                            <div className="h-full bg-[#00704A] transition-all"
                              style={{ width: `${(summary.receitas / (summary.receitas + summary.despesas)) * 100}%` }} />
                            <div className="h-full bg-red-400 transition-all"
                              style={{ width: `${(summary.despesas / (summary.receitas + summary.despesas)) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#00704A] inline-block" />
                              Receitas {((summary.receitas / (summary.receitas + summary.despesas)) * 100).toFixed(0)}%
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                              Despesas {((summary.despesas / (summary.receitas + summary.despesas)) * 100).toFixed(0)}%
                            </span>
                          </div>
                          {/* comparativo mês anterior */}
                          {analytics.comparison.previous && (
                            <div className="mt-4 pt-4 border-t border-[#E5D8C5] grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-gray-400">Mês anterior · Receitas</p>
                                <p className="font-semibold text-[#00704A]">{fmt(analytics.comparison.previous.receitas)}</p>
                              </div>
                              <div>
                                <p className="text-gray-400">Mês anterior · Despesas</p>
                                <p className="font-semibold text-red-500">{fmt(analytics.comparison.previous.despesas)}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* categorias */}
                    <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Por categoria</p>
                      {analytics.categories.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Sem lançamentos categorizados</p>
                      ) : (
                        <div className="space-y-3">
                          {analytics.categories.slice(0, 6).map((c) => (
                            <div key={c.category}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-[#00704A]" style={{ color: CAT_COLORS[c.category] }}>
                                  {c.category}
                                </span>
                                <span className="text-gray-400">{fmt(c.receitas + c.despesas)}</span>
                              </div>
                              <div className="h-1.5 bg-[#EFE7DA] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${((c.receitas + c.despesas) / catMax) * 100}%`,
                                    backgroundColor: CAT_COLORS[c.category] || "#00704A",
                                  }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VENCIMENTOS PRÓXIMOS */}
                  {upcoming.length > 0 && (() => {
                    const aReceber = upcoming.filter((t) => t.type === "receita");
                    const aPagar   = upcoming.filter((t) => t.type === "despesa");

                    const UpcomingCard = ({ tx }) => {
                      const diff = daysDiff(tx.dueDate);
                      const overdue = diff < 0;
                      const urgent  = diff >= 0 && diff <= 7;
                      const isReceita = tx.type === "receita";
                      return (
                        <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 ${overdue ? "border-red-300" : urgent ? "border-amber-300" : "border-[#E5D8C5]"}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${isReceita ? "bg-emerald-100" : "bg-red-100"}`}>
                              {isReceita
                                ? <TrendingUp size={13} className="text-emerald-600" />
                                : <TrendingDown size={13} className="text-red-500" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#00704A] truncate">{tx.description}</p>
                              {resolvePatient(tx) && (
                                <p className="text-xs text-gray-400">{resolvePatient(tx).name}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className={`text-sm font-bold ${isReceita ? "text-emerald-600" : "text-red-500"}`}>
                              {isReceita ? "+" : "−"}{fmt(tx.amount).replace("R$ ", "")}
                            </p>
                            <p className={`text-[11px] font-semibold ${overdue ? "text-red-500" : urgent ? "text-amber-600" : "text-gray-400"}`}>
                              {overdue ? `Atrasado ${Math.abs(diff)}d` : diff === 0 ? "Vence hoje" : `Vence em ${diff}d`}
                            </p>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={14} className="text-amber-500" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Vencimentos nos próximos 30 dias · {upcoming.length} pendente{upcoming.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aReceber.length > 0 && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp size={15} className="text-emerald-600" />
                              <p className="text-sm font-semibold text-emerald-800">
                                A receber · {aReceber.length}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {aReceber.map((tx) => <UpcomingCard key={tx.id} tx={tx} />)}
                            </div>
                          </div>
                        )}
                        {aPagar.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingDown size={15} className="text-red-500" />
                              <p className="text-sm font-semibold text-red-800">
                                A pagar · {aPagar.length}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {aPagar.map((tx) => <UpcomingCard key={tx.id} tx={tx} />)}
                            </div>
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB: LANÇAMENTOS ─────────────────────────────────────────────────── */}
      {tab === "lancamentos" && (
        <>
          {/* filtros */}
          <div className="flex flex-wrap gap-2 mb-5 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mês</label>
              <input type="month" value={lancMonth} onChange={(e) => setLancMonth(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={lancType} onChange={(e) => setLancType(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select value={lancStatus} onChange={(e) => setLancStatus(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
              <select value={lancCat} onChange={(e) => setLancCat(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm">
                <option value="">Todas</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={loadLancamentos}
              className="flex items-center gap-1.5 bg-[#00704A] hover:bg-[#0A3326] text-white text-sm px-4 py-2 rounded-xl transition">
              <Filter size={14} /> Filtrar
            </button>
          </div>

          {loadingLanc ? <Spinner /> : lancamentos.length === 0 ? (
            <Empty icon={Wallet} text="Nenhum lançamento encontrado" sub="Tente ajustar os filtros ou crie um novo lançamento" />
          ) : (
            <div className="space-y-2">
              {lancamentos.map((tx) => (
                <div key={tx.id} className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
                  {/* linha principal */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                    <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${tx.type === "receita" ? "bg-emerald-100" : "bg-red-100"}`}>
                      {tx.type === "receita"
                        ? <TrendingUp size={16} className="text-emerald-600" />
                        : <TrendingDown size={16} className="text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#00704A] text-sm truncate">{tx.description}</p>
                        {tx.isRecurring && <Repeat2 size={12} className="text-[#6F7F73] shrink-0" title="Recorrente" />}
                        {tx.category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white inline-flex items-center gap-1"
                            style={{ backgroundColor: CAT_COLORS[tx.category] || "#9ca3af" }}>
                            {tx.category === "Faturamento" && <Zap size={10} />}
                            {tx.category}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto flex flex-col items-end gap-0.5">
                          <span>{fmtDateShort(tx.paidAt || tx.dueDate || tx.createdAt)}</span>
                          <span className="text-[10px] text-gray-300">
                            {tx.paidAt ? "pago em" : tx.dueDate ? "vence em" : "criado em"}
                          </span>
                        </span>
                      </div>
                      <TxRef tx={tx} />
                      {tx.paymentMethod && (
                        <span className="text-xs text-gray-400 mt-0.5 block">{tx.paymentMethod}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-base font-bold ${tx.type === "receita" ? "text-emerald-600" : "text-red-500"}`}>
                          {tx.type === "receita" ? "+" : "−"}{fmt(tx.amount).replace("R$ ", "")}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[tx.status] || STATUS_PILL.cancelado}`}>
                          {tx.status === "pendente" ? "Pendente" : tx.status === "confirmado" ? "Confirmado" : "Cancelado"}
                        </span>
                      </div>

                      {/* ações */}
                      <div className="flex flex-col gap-1">
                        {tx.status === "pendente" && (
                          <button onClick={() => { setApprovingId(approvingId === tx.id ? null : tx.id); setApproveForm({ amount: tx.amount > 0 ? String(tx.amount) : "", method: "" }); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                            title="Confirmar">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button onClick={() => setModalData(tx)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#EFE7DA] text-[#00704A] hover:bg-[#E5D8C5] transition"
                          title="Editar">
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* painel confirmar */}
                  {approvingId === tx.id && (
                    <div className="border-t border-[#E5D8C5] bg-white px-5 py-4">
                      <p className="text-xs font-semibold text-[#00704A] mb-3 uppercase tracking-wide">Confirmar recebimento</p>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Valor (R$) *</label>
                          <input type="number" min="0" step="0.01" value={approveForm.amount}
                            onChange={(e) => setApproveForm((p) => ({ ...p, amount: e.target.value }))}
                            placeholder="0,00" className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm w-36" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Forma de pagamento</label>
                          <select value={approveForm.method} onChange={(e) => setApproveForm((p) => ({ ...p, method: e.target.value }))}
                            className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm min-w-[180px]">
                            <option value="">Selecione</option>
                            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <button onClick={() => handleApprove(tx.id)}
                          className="bg-[#00704A] hover:bg-[#0A3326] text-white px-5 py-2 rounded-xl text-sm font-medium transition">
                          Confirmar
                        </button>
                        <button onClick={() => handleCancel(tx.id)}
                          className="border border-red-300 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm transition">
                          Cancelar transação
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: EXTRATO ─────────────────────────────────────────────────────── */}
      {tab === "extrato" && (
        <>
          {/* filtros */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">De</label>
              <input type="date" value={extStart} onChange={(e) => setExtStart(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Até</label>
              <input type="date" value={extEnd} onChange={(e) => setExtEnd(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
              <select value={extType} onChange={(e) => setExtType(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm">
                <option value="">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Forma</label>
              <select value={extMethod} onChange={(e) => setExtMethod(e.target.value)}
                className="border border-[#C4895A] rounded-xl px-3 py-2 text-sm">
                <option value="">Todas</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button onClick={loadExtrato}
              className="flex items-center gap-1.5 bg-[#00704A] hover:bg-[#0A3326] text-white text-sm px-4 py-2 rounded-xl transition">
              <Filter size={14} /> Filtrar
            </button>
            {extrato.length > 0 && (
              <button onClick={handleExportCSV}
                className="flex items-center gap-1.5 border border-[#C4895A] text-[#00704A] hover:bg-[#EFE7DA] text-sm px-4 py-2 rounded-xl transition ml-auto">
                <Download size={14} /> Exportar CSV
              </button>
            )}
          </div>

          {loadingExt ? <Spinner /> : extrato.length === 0 ? (
            <Empty icon={Wallet} text="Nenhuma movimentação encontrada" sub="Selecione um período ou ajuste os filtros" />
          ) : (
            <div className="bg-white border border-[#E5D8C5] rounded-2xl overflow-hidden">
              {/* header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-[#FAF7F2] border-b border-[#E5D8C5] text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                <span>Descrição</span>
                <span>Categoria</span>
                <span>Valor</span>
                <span>Forma</span>
                <span className="text-right">Saldo</span>
              </div>

              <div className="divide-y divide-[#FAF7F2]">
                {extratoGrouped.map((item, i) => {
                  if (item.type === "header") {
                    return (
                      <div key={`h-${i}`} className="px-5 py-2 bg-[#F9F6F1] border-b border-[#EFE7DA]">
                        <p className="text-xs font-semibold text-[#6F7F73] capitalize">{fmtDateGroup(item.date)}</p>
                      </div>
                    );
                  }
                  const { tx } = item;
                  return (
                    <div key={tx.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center hover:bg-[#FAFAF8] transition">
                      <div>
                        <div className="flex items-center gap-2">
                          {tx.type === "receita"
                            ? <TrendingUp size={13} className="text-emerald-500 shrink-0" />
                            : <TrendingDown size={13} className="text-red-400 shrink-0" />}
                          <p className="text-sm font-semibold text-[#00704A] truncate">{tx.description}</p>
                          {tx.isRecurring && <Repeat2 size={11} className="text-gray-400 shrink-0" />}
                        </div>
                        <div className="ml-5">
                          <TxRef tx={tx} />
                        </div>
                      </div>

                      <div>
                        {tx.category ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white inline-flex items-center gap-1"
                            style={{ backgroundColor: CAT_COLORS[tx.category] || "#9ca3af" }}>
                            {tx.category === "Faturamento" && <Zap size={10} />}
                            {tx.category}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </div>

                      <p className={`text-sm font-bold ${tx.type === "receita" ? "text-emerald-600" : "text-red-500"}`}>
                        {tx.type === "receita" ? "+" : "−"}{fmt(tx.amount).replace("R$ ", "R$ ")}
                      </p>

                      <p className="text-xs text-gray-400">{tx.paymentMethod || "—"}</p>

                      <p className={`text-sm font-bold text-right ${tx.balance >= 0 ? "text-[#00704A]" : "text-red-500"}`}>
                        {fmt(tx.balance)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* footer */}
              <div className="px-5 py-3 bg-[#FAF7F2] border-t border-[#E5D8C5] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-400">{extrato.length} lançamento{extrato.length !== 1 ? "s" : ""}</p>
                <div className="flex gap-5 text-xs font-semibold">
                  <span className="text-emerald-600">Entradas: {fmt(extTotals.receitas)}</span>
                  <span className="text-red-500">Saídas: {fmt(extTotals.despesas)}</span>
                  <span className={`${extTotals.receitas - extTotals.despesas >= 0 ? "text-[#00704A]" : "text-red-600"}`}>
                    Saldo: {fmt(extTotals.receitas - extTotals.despesas)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: GUARDIÃO IA ─────────────────────────────────────────────────── */}
      {tab === "guardiao" && (
        <GuardianTab data={guardian} loading={loadingGuardian} onRefresh={loadGuardian} />
      )}

      {/* MODAL criar / editar */}
      {modalData !== null && (
        <TransactionModal
          initial={modalData?.id ? modalData : null}
          onClose={() => setModalData(null)}
          onSave={handleSave}
        />
      )}
    </MainLayout>
  );
}
