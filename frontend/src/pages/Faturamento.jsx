import { useState, useEffect, useCallback } from "react";
import {
  Plus, Copy, Check, QrCode, Link2, X,
  TrendingUp, Clock, CheckCircle2, XCircle, Receipt,
  CreditCard, Barcode, Smartphone, ExternalLink, Search,
  RefreshCw, Download, Eye, ArrowDownToLine, ArrowUpFromLine,
  Wallet, Settings, Key, Bell, Palette, ChevronRight,
  AlertCircle, Shield, Landmark, ToggleLeft, ToggleRight,
  History, Sparkles, Zap,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import toast from "react-hot-toast";

// ─── mock data ────────────────────────────────────────────────────────────────

const MOCK_CHARGES = [
  {
    id: "ch_001", patient: "Ana Clara Oliveira",
    description: "Toxina Botulínica — Frontal + Glabela + Orbicular",
    amount: 1200, method: "pix", status: "paid",
    createdAt: "2026-05-28", dueDate: "2026-05-28", paidAt: "2026-05-28",
    paymentLink: "https://sandbox.asaas.com/c/pix-exemplo-001", origin: "agendamento",
  },
  {
    id: "ch_002", patient: "Beatriz Souza",
    description: "Harmonização Facial Completa",
    amount: 4500, method: "credit_card", status: "pending",
    createdAt: "2026-05-29", dueDate: "2026-06-05", paidAt: null,
    paymentLink: "https://sandbox.asaas.com/c/card-exemplo-002",
    installments: 3, origin: "orçamento",
  },
  {
    id: "ch_003", patient: "Carolina Mendes",
    description: "Preenchimento Labial — 1 seringa",
    amount: 950, method: "pix", status: "pending",
    createdAt: "2026-05-30", dueDate: "2026-06-01", paidAt: null,
    paymentLink: "https://sandbox.asaas.com/c/pix-exemplo-003", origin: "agendamento",
  },
  {
    id: "ch_004", patient: "Roberto Carvalho",
    description: "Bioestimulador de Colágeno — Radiesse",
    amount: 2200, method: "boleto", status: "overdue",
    createdAt: "2026-05-01", dueDate: "2026-05-10", paidAt: null,
    paymentLink: "https://sandbox.asaas.com/c/boleto-exemplo-004", origin: "orçamento",
  },
  {
    id: "ch_005", patient: "Fernanda Lima",
    description: "Microagulhamento com Drug Delivery",
    amount: 700, method: "pix", status: "cancelled",
    createdAt: "2026-05-15", dueDate: "2026-05-15", paidAt: null,
    paymentLink: null, origin: "agendamento",
  },
  {
    id: "ch_006", patient: "Marcelo Santos",
    description: "Fios de PDO — Lifting Facial (1/2)",
    amount: 1600, method: "credit_card", status: "paid",
    createdAt: "2026-05-10", dueDate: "2026-05-10", paidAt: "2026-05-10",
    paymentLink: "https://sandbox.asaas.com/c/card-exemplo-006",
    installments: 2, origin: "orçamento",
  },
];

const MOCK_BALANCE = {
  available: 8340.50,
  inTransit: 2150.00,
  receivedThisMonth: 12480.00,
};

const MOCK_WITHDRAWALS = [
  { id: "saq_001", amount: 3000, pixKey: "clinica@email.com.br", status: "completed", date: "2026-05-25", time: "14:32" },
  { id: "saq_002", amount: 1500, pixKey: "clinica@email.com.br", status: "completed", date: "2026-05-18", time: "09:15" },
  { id: "saq_003", amount: 2800, pixKey: "clinica@email.com.br", status: "completed", date: "2026-05-10", time: "11:47" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(v) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const INPUT = "w-full border border-creme-200 bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition";

// ─── status / method config ───────────────────────────────────────────────────

const STATUS = {
  // Asaas status
  CONFIRMED:       { label: "Pago",       bg: "bg-verde-100 text-verde-800",  dot: "bg-sucesso" },
  RECEIVED:        { label: "Recebido",   bg: "bg-verde-100 text-verde-800",  dot: "bg-sucesso" },
  PENDING:         { label: "Aguardando", bg: "bg-ambar-50 text-ambar-700",  dot: "bg-ambar" },
  OVERDUE:         { label: "Vencida",    bg: "bg-[#FBEDEC] text-[#C2473C]",      dot: "bg-erro"   },
  CANCELLED:       { label: "Cancelada",  bg: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"  },
  REFUNDED:        { label: "Estornada",  bg: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"  },
  // mock status (fallback)
  paid:      { label: "Pago",       bg: "bg-verde-100 text-verde-800",  dot: "bg-sucesso" },
  pending:   { label: "Aguardando", bg: "bg-ambar-50 text-ambar-700",  dot: "bg-ambar" },
  overdue:   { label: "Vencida",    bg: "bg-[#FBEDEC] text-[#C2473C]",      dot: "bg-erro"   },
  cancelled: { label: "Cancelada",  bg: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"  },
};

const METHOD = {
  pix:         { label: "PIX",    icon: Smartphone, color: "text-verde" },
  credit_card: { label: "Cartão", icon: CreditCard, color: "text-info" },
  boleto:      { label: "Boleto", icon: Barcode,    color: "text-ambar" },
};

// ─── shared components ────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="bg-white border border-creme-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black font-mono text-verde-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function MethodBadge({ method }) {
  const m = METHOD[method] ?? METHOD.pix;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.color}`}>
      <Icon size={13} /> {m.label}
    </span>
  );
}

// ─── charge detail modal ──────────────────────────────────────────────────────

function ChargeDetailModal({ charge, onClose, onSimulate }) {
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  function copy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSimulate() {
    setSimulating(true);
    try {
      await onSimulate(charge.id);
      onClose();
    } finally {
      setSimulating(false);
    }
  }

  async function handleSendLink() {
    setSendingLink(true);
    try {
      await api.post(`/billing/charges/${charge.id}/send-link`);
      toast.success("Link enviado via WhatsApp!");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao enviar link");
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-creme-100">
          <div>
            <p className="text-sm font-bold text-verde">{charge.patient}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{charge.description}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-creme-50 flex items-center justify-center text-gray-400 transition">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-verde">{fmt(charge.amount)}</p>
            <StatusBadge status={charge.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FAF8F5] rounded-xl p-3">
              <p className="text-gray-400 mb-1">Forma</p>
              <MethodBadge method={charge.method} />
            </div>
            <div className="bg-[#FAF8F5] rounded-xl p-3">
              <p className="text-gray-400 mb-1">Vencimento</p>
              <p className="font-semibold text-verde">{fmtDate(charge.dueDate)}</p>
            </div>
            {charge.installments && (
              <div className="bg-[#FAF8F5] rounded-xl p-3">
                <p className="text-gray-400 mb-1">Parcelamento</p>
                <p className="font-semibold text-verde">{charge.installments}x de {fmt(charge.amount / charge.installments)}</p>
              </div>
            )}
            {charge.paidAt && (
              <div className="bg-verde-50 rounded-xl p-3">
                <p className="text-gray-400 mb-1">Pago em</p>
                <p className="font-semibold text-verde-800">{fmtDate(charge.paidAt)}</p>
              </div>
            )}
          </div>
          {charge.method === "pix" && charge.status === "pending" && (
            <div className="border border-creme-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-verde mb-3 flex items-center gap-1.5">
                <QrCode size={14} /> QR Code PIX
              </p>
              <div className="flex items-center justify-center bg-[#FAF8F5] rounded-xl py-6 mb-3">
                <div className="w-32 h-32 bg-verde rounded-xl flex items-center justify-center opacity-10">
                  <QrCode size={64} className="text-white" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 text-center">QR Code gerado após integração com Asaas</p>
            </div>
          )}
          {charge.paymentLink && charge.status !== "cancelled" && (
            <div className="border border-creme-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-verde mb-2 flex items-center gap-1.5">
                <Link2 size={14} /> Link de pagamento
              </p>
              <div className="flex items-center gap-2 bg-[#FAF8F5] rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-500 flex-1 truncate">{charge.paymentLink}</p>
                <button onClick={() => copy(charge.paymentLink)}
                  className="shrink-0 w-7 h-7 rounded-lg bg-verde flex items-center justify-center text-white transition hover:bg-verde-900">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}
          {(charge.status === "pending" || charge.status === "PENDING" || charge.status === "OVERDUE" || charge.status === "overdue") && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={() => { copy(charge.paymentLink ?? ""); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-verde hover:bg-verde-900 text-white py-2.5 rounded-xl text-xs font-semibold transition">
                  <Copy size={13} /> Copiar link
                </button>
                <button
                  onClick={handleSendLink}
                  disabled={sendingLink}
                  className="flex-1 flex items-center justify-center gap-2 border border-ambar text-verde hover:bg-creme-100 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60">
                  {sendingLink
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <ExternalLink size={13} />}
                  {sendingLink ? "Enviando…" : "WhatsApp"}
                </button>
              </div>
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="w-full flex items-center justify-center gap-2 bg-ambar-500 hover:bg-ambar-600 text-white py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60"
              >
                {simulating ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                {simulating ? "Simulando…" : "Simular pagamento (sandbox)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── new charge modal ─────────────────────────────────────────────────────────

function NewChargeModal({ onClose, onSave }) {
  const [form, setForm] = useState({ patientId: "", patient: "", description: "", amount: "", method: "pix", dueDate: "", installments: "1" });
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/patients?search=${patientSearch}&limit=6`);
        setPatientResults(r.data?.data ?? r.data ?? []);
      } catch { setPatientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patientId || !form.amount || !form.dueDate) return toast.error("Selecione o paciente, valor e vencimento");
    setLoading(true);
    try {
      const res = await api.post("/billing/charges", {
        patientId: form.patientId,
        description: form.description || "Cobrança manual",
        amount: Number(form.amount),
        method: form.method,
        dueDate: form.dueDate,
        installments: form.method === "credit_card" ? Number(form.installments) : 1,
      });
      toast.success("Cobrança gerada no Asaas!");
      onSave(normalizeCharge(res.data));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao gerar cobrança");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-creme-100">
          <p className="text-base font-bold text-verde">Nova cobrança</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-creme-50 flex items-center justify-center text-gray-400 transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* paciente combobox */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Paciente</label>
            {form.patientId ? (
              <div className="flex items-center justify-between border border-verde bg-[#F0F7F5] rounded-xl px-4 py-2.5">
                <span className="text-sm font-medium text-verde">{form.patient}</span>
                <button type="button" onClick={() => set("patientId", "") || set("patient", "") || setPatientSearch("")}
                  className="text-gray-400 hover:text-erro transition"><X size={14} /></button>
              </div>
            ) : (
              <>
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Digite o nome do paciente…"
                  className={INPUT}
                />
                {patientResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-creme-200 rounded-xl shadow-lg overflow-hidden">
                    {patientResults.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => { set("patientId", p.id); set("patient", p.name); setPatientSearch(""); setPatientResults([]); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-creme-50 transition border-b border-[#F0EAE0] last:border-0">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Descrição</label>
            <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex: Harmonização Facial" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Valor (R$)</label>
              <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" min="1" step="0.01" required className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Vencimento</label>
              <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} required className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Forma de pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ key: "pix", icon: Smartphone, label: "PIX" }, { key: "credit_card", icon: CreditCard, label: "Cartão" }, { key: "boleto", icon: Barcode, label: "Boleto" }].map(({ key, icon: Icon, label }) => (
                <button key={key} type="button" onClick={() => set("method", key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition ${form.method === key ? "bg-verde text-white border-verde" : "border-creme-200 text-gray-500 hover:bg-creme-50"}`}>
                  <Icon size={16} />{label}
                </button>
              ))}
            </div>
          </div>
          {form.method === "credit_card" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Parcelas</label>
              <select value={form.installments} onChange={(e) => set("installments", e.target.value)} className={INPUT}>
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}x {form.amount ? `de ${fmt(Number(form.amount) / n)}` : ""}</option>
                ))}
              </select>
            </div>
          )}
          {form.amount > 0 && (
            <div className="bg-[#FAF8F5] border border-creme-200 rounded-xl p-3 text-xs text-gray-500 flex items-center justify-between">
              <span>Total a cobrar</span>
              <span className="font-bold text-verde text-sm">{fmt(Number(form.amount))}</span>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-creme-200 text-sm font-medium text-gray-500 hover:bg-creme-50 transition">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-verde hover:bg-verde-900 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
              {loading ? "Gerando…" : "Gerar cobrança"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── saldo & saques tab ───────────────────────────────────────────────────────

function SaldoTab() {
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingBalance(true);
      try {
        const [balRes, trRes] = await Promise.all([
          api.get("/billing/balance"),
          api.get("/billing/transfers"),
        ]);
        setBalance(balRes.data);
        setWithdrawals(trRes.data?.data ?? []);
      } catch {
        setBalance(MOCK_BALANCE);
        setWithdrawals(MOCK_WITHDRAWALS);
      } finally {
        setLoadingBalance(false);
      }
    }
    load();
  }, []);

  async function handleWithdraw(e) {
    e.preventDefault();
    if (!pixKey) return toast.error("Informe a chave PIX de destino");
    const val = Number(amount);
    if (!val || val <= 0) return toast.error("Informe um valor válido");
    setLoading(true);
    try {
      const res = await api.post("/billing/transfer", { pixAddressKey: pixKey, value: val });
      toast.success("Transferência PIX iniciada!");
      setWithdrawals((prev) => [res.data, ...prev]);
      setAmount("");
      // atualiza saldo
      const balRes = await api.get("/billing/balance");
      setBalance(balRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao transferir");
    } finally {
      setLoading(false);
    }
  }

  const WITHDRAW_STATUS = {
    completed:  { label: "Concluída", bg: "bg-verde-100 text-verde-800" },
    processing: { label: "Processando", bg: "bg-ambar-50 text-ambar-700" },
    failed:     { label: "Falhou", bg: "bg-[#FBEDEC] text-[#C2473C]" },
  };

  return (
    <div className="space-y-5">
      {/* saldo cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-verde rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3 opacity-70">
            <Wallet size={14} />
            <p className="text-xs font-semibold uppercase tracking-wide">Disponível para saque</p>
          </div>
          {loadingBalance
            ? <div className="h-9 w-32 bg-white/20 rounded-lg animate-pulse" />
            : <p className="text-3xl font-black">{fmt(balance?.balance ?? 0)}</p>
          }
          <p className="text-xs opacity-60 mt-1">Saldo Asaas em tempo real</p>
        </div>

        <div className="bg-white border border-creme-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <Clock size={14} />
            <p className="text-xs font-semibold uppercase tracking-wide">Em trânsito</p>
          </div>
          {loadingBalance
            ? <div className="h-9 w-28 bg-creme-100 rounded-lg animate-pulse" />
            : <p className="text-3xl font-black text-verde">{fmt(0)}</p>
          }
          <p className="text-xs text-gray-400 mt-1">Cobranças pagas aguardando compensação</p>
        </div>

        <div className="bg-white border border-creme-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-gray-400">
            <TrendingUp size={14} />
            <p className="text-xs font-semibold uppercase tracking-wide">Transferências realizadas</p>
          </div>
          {loadingBalance
            ? <div className="h-9 w-24 bg-creme-100 rounded-lg animate-pulse" />
            : <p className="text-3xl font-black text-verde">{withdrawals.length}</p>
          }
          <p className="text-xs text-gray-400 mt-1">Total no histórico</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* formulário de saque */}
        <div className="bg-white border border-creme-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-verde/10 flex items-center justify-center">
              <ArrowUpFromLine size={15} className="text-verde" />
            </div>
            <p className="text-sm font-bold text-verde">Transferir para PIX</p>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Chave PIX de destino</label>
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className={INPUT}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Valor</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  min="1"
                  step="0.01"
                  max={MOCK_BALANCE.available}
                  className={INPUT + " pr-28"}
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(MOCK_BALANCE.available))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-verde bg-creme-100 px-2 py-1 rounded-lg hover:bg-creme-200 transition"
                >
                  Tudo disponível
                </button>
              </div>
              {amount && Number(amount) > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Saldo após transferência: <span className="font-semibold text-verde">{fmt(MOCK_BALANCE.available - Number(amount))}</span>
                </p>
              )}
            </div>

            <div className="bg-ambar-50 border border-ambar-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={13} className="text-ambar-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-ambar-700">
                Transferências PIX são processadas em segundos, 24h/dia. Conecte o Asaas para ativar essa funcionalidade.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !pixKey || !amount}
              className="w-full py-3 rounded-xl bg-verde hover:bg-verde-900 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <><RefreshCw size={14} className="animate-spin" /> Transferindo…</>
                : <><ArrowUpFromLine size={14} /> Transferir agora</>
              }
            </button>
          </form>
        </div>

        {/* histórico de saques */}
        <div className="bg-white border border-creme-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-verde/10 flex items-center justify-center">
              <History size={15} className="text-verde" />
            </div>
            <p className="text-sm font-bold text-verde">Histórico de transferências</p>
          </div>

          {withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <ArrowUpFromLine size={24} className="opacity-30" />
              <p className="text-xs">Nenhuma transferência ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => {
                const s = WITHDRAW_STATUS[w.status] ?? WITHDRAW_STATUS.processing;
                return (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAF8F5] transition">
                    <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] flex items-center justify-center shrink-0">
                      <ArrowUpFromLine size={13} className="text-sucesso" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{fmt(w.amount)}</p>
                      <p className="text-[10px] text-gray-400 truncate">{w.pixKey}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{w.date} · {w.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── configuração tab ─────────────────────────────────────────────────────────

function ConfigTab() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [defaultPix, setDefaultPix] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [methods, setMethods] = useState({ pix: true, credit_card: true, boleto: false });
  const [notifications, setNotifications] = useState({ paid: true, overdue: true, webhook: false });
  const [saving, setSaving] = useState(false);

  function toggleMethod(key) { setMethods((m) => ({ ...m, [key]: !m[key] })); }
  function toggleNotif(key)  { setNotifications((n) => ({ ...n, [key]: !n[key] })); }

  async function save() {
    if (!apiKey) return toast.error("Informe a API Key do Asaas");
    setSaving(true);
    try {
      await api.post("/billing/config", { asaasApiKey: apiKey, defaultPixKey: defaultPix, clinicName });
      toast.success("Configurações salvas e chave validada!");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  }

  function Toggle({ active, onToggle }) {
    return (
      <button onClick={onToggle} className="transition">
        {active
          ? <ToggleRight size={24} className="text-verde" />
          : <ToggleLeft  size={24} className="text-gray-300" />
        }
      </button>
    );
  }

  function Section({ icon: Icon, title, children }) {
    return (
      <div className="bg-white border border-creme-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-verde/10 flex items-center justify-center">
            <Icon size={15} className="text-verde" />
          </div>
          <p className="text-sm font-bold text-verde">{title}</p>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* banner conectar */}
      {!apiKey && (
        <div className="bg-verde rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-ambar" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Conecte sua conta Asaas</p>
            <p className="text-xs text-white/60 mt-0.5">Crie uma conta gratuita em <span className="underline">sandbox.asaas.com</span> e cole sua API Key abaixo para ativar cobranças reais.</p>
          </div>
          <button
            onClick={() => toast("Abra sandbox.asaas.com no navegador")}
            className="shrink-0 text-xs font-semibold bg-ambar text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#A88A58] transition"
          >
            Criar conta <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* api key */}
      <Section icon={Key} title="Integração Asaas">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">API Key</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="$aact_xxxxxxxxxxxxxxxxxxxx"
                className={INPUT + " pr-20"}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-verde transition"
              >
                {showKey ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Encontre sua API Key em <span className="text-verde font-medium">Minha conta → Integrações</span> no Asaas.
            </p>
          </div>

          {apiKey && (
            <div className="flex items-center gap-2 bg-verde-50 border border-verde-200 rounded-xl px-4 py-2.5">
              <Shield size={13} className="text-sucesso shrink-0" />
              <p className="text-xs text-verde-800 font-medium">Chave configurada — clique em Salvar para ativar</p>
            </div>
          )}
        </div>
      </Section>

      {/* pix padrão */}
      <Section icon={Landmark} title="Conta de recebimento">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Chave PIX padrão para saques</label>
            <input
              value={defaultPix}
              onChange={(e) => setDefaultPix(e.target.value)}
              placeholder="CPF, CNPJ, e-mail ou telefone"
              className={INPUT}
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Será preenchida automaticamente nos saques. Pode alterar a qualquer momento.
            </p>
          </div>
        </div>
      </Section>

      {/* identidade visual */}
      <Section icon={Palette} title="Identidade nas cobranças">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nome exibido ao paciente</label>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="Ex: Clínica Estética Ana Paula"
              className={INPUT}
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Aparece no link de pagamento e no comprovante do paciente.
            </p>
          </div>
        </div>
      </Section>

      {/* formas aceitas */}
      <Section icon={CreditCard} title="Formas de pagamento aceitas">
        <div className="space-y-3">
          {[
            { key: "pix",         icon: Smartphone, label: "PIX",            sub: "Taxa 0,99% · Aprovação instantânea"    },
            { key: "credit_card", icon: CreditCard, label: "Cartão de crédito", sub: "Taxa 2,99%–4,99% · Parcelamento disponível" },
            { key: "boleto",      icon: Barcode,    label: "Boleto bancário",  sub: "Taxa R$ 3,49 fixo · Compensação em 1–3 dias" },
          ].map(({ key, icon: Icon, label, sub }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-creme-100 hover:bg-[#FAF8F5] transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-creme-50 flex items-center justify-center">
                  <Icon size={15} className="text-verde" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  <p className="text-[10px] text-gray-400">{sub}</p>
                </div>
              </div>
              <Toggle active={methods[key]} onToggle={() => toggleMethod(key)} />
            </div>
          ))}
        </div>
      </Section>

      {/* notificações */}
      <Section icon={Bell} title="Notificações automáticas ao paciente">
        <div className="space-y-3">
          {[
            { key: "paid",    label: "Confirmação de pagamento", sub: "Envia mensagem quando o pagamento é confirmado" },
            { key: "overdue", label: "Lembrete de vencimento",   sub: "Lembra o paciente 1 dia antes do vencimento"   },
            { key: "webhook", label: "Notificação de cobrança",  sub: "Avisa quando uma nova cobrança é gerada"        },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-creme-100 hover:bg-[#FAF8F5] transition">
              <div>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-[10px] text-gray-400">{sub}</p>
              </div>
              <Toggle active={notifications[key]} onToggle={() => toggleNotif(key)} />
            </div>
          ))}
        </div>
      </Section>

      {/* salvar */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-verde hover:bg-verde-900 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? <><RefreshCw size={14} className="animate-spin" /> Salvando…</> : <><Settings size={14} /> Salvar configurações</>}
      </button>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "cobrancas", label: "Cobranças",      icon: Receipt          },
  { id: "saldo",     label: "Saldo & Saques", icon: ArrowDownToLine  },
  { id: "config",    label: "Configuração",   icon: Settings         },
];

// normaliza charge do Asaas para o formato do frontend
function normalizeCharge(c) {
  return {
    id: c.id,
    patient: c.customer?.name ?? c.customerName ?? "—",
    description: c.description ?? "",
    amount: c.value ?? c.amount ?? 0,
    method: { PIX: "pix", CREDIT_CARD: "credit_card", BOLETO: "boleto" }[c.billingType] ?? "pix",
    status: c.status,
    createdAt: c.dateCreated ?? c.createdAt,
    dueDate: c.dueDate,
    paidAt: c.paymentDate ?? c.paidAt ?? null,
    paymentLink: c.invoiceUrl ?? c.paymentLink ?? null,
    installments: c.installmentCount ?? c.installments,
    origin: c.externalReference ? "sistema" : "manual",
    pixInfo: c.pixQrCode ?? null,
  };
}

export default function Faturamento() {
  const [tab, setTab] = useState("cobrancas");
  const [charges, setCharges] = useState([]);
  const [loadingCharges, setLoadingCharges] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  async function simulateCharge(chargeId) {
    try {
      await api.post(`/billing/charges/${chargeId}/simulate`);
      toast.success("Pagamento confirmado!");
      const today = new Date().toISOString().split("T")[0];
      setCharges((prev) => prev.map((c) =>
        c.id === chargeId ? { ...c, status: "CONFIRMED", paidAt: today } : c
      ));
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao simular pagamento");
    }
  }

  const loadCharges = useCallback(async () => {
    setLoadingCharges(true);
    try {
      const res = await api.get("/billing/charges");
      const list = res.data?.data ?? [];
      // busca nome do customer para cada cobrança
      setCharges(list.map(normalizeCharge));
    } catch {
      // fallback para mock se Asaas não estiver configurado
      setCharges(MOCK_CHARGES);
    } finally {
      setLoadingCharges(false);
    }
  }, []);

  useEffect(() => { loadCharges(); }, [loadCharges]);

  const isPaid    = (c) => c.status === "CONFIRMED" || c.status === "RECEIVED" || c.status === "paid";
  const isPending = (c) => c.status === "PENDING" || c.status === "pending";
  const isOverdue = (c) => c.status === "OVERDUE" || c.status === "overdue";

  const paid    = charges.filter(isPaid);
  const pending = charges.filter(isPending);
  const overdue = charges.filter(isOverdue);

  const totalPaid    = paid.reduce((s, c) => s + Number(c.amount), 0);
  const totalPending = pending.reduce((s, c) => s + Number(c.amount), 0);
  const totalOverdue = overdue.reduce((s, c) => s + Number(c.amount), 0);
  const convRate     = charges.length > 0 ? Math.round((paid.length / charges.length) * 100) : 0;

  const filtered = charges.filter((c) => {
    if (search && !c.patient?.toLowerCase().includes(search.toLowerCase()) &&
        !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterMethod && c.method !== filterMethod) return false;
    return true;
  });

  return (
    <MainLayout>
      {/* header */}
      <div className="flex items-start justify-between mb-7 gap-3 flex-wrap">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Faturamento</h1>
          <p className="text-gray-500 mt-1 text-sm">Cobranças, saldo e transferências</p>
        </div>
        {tab === "cobrancas" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast("Exportação disponível em breve")}
              className="flex items-center gap-2 border border-ambar text-verde hover:bg-creme-100 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <Download size={14} /> Exportar
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-verde hover:bg-verde-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <Plus size={15} /> Nova cobrança
            </button>
          </div>
        )}
        {tab === "saldo" && (
          <button
            onClick={() => toast("Extrato completo disponível com integração Asaas")}
            className="flex items-center gap-2 border border-ambar text-verde hover:bg-creme-100 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Download size={14} /> Extrato
          </button>
        )}
      </div>

      {/* banner — sandbox ativo */}
      <div className="bg-verde-50 border border-verde-200 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-verde-100 flex items-center justify-center shrink-0">
          <Shield size={12} className="text-sucesso" />
        </div>
        <p className="text-xs text-verde-900 font-medium flex-1">
          <span className="font-bold">Asaas Sandbox conectado</span> — cobranças criadas aqui são de teste.
          Para produção, troque a chave em{" "}
          <button onClick={() => setTab("config")} className="underline font-bold">Configuração</button>.
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-2 border-b-[1.5px] border-creme-200 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-bold transition -mb-px border-b-[2.5px] ${
              tab === id ? "text-verde border-verde" : "text-gray-500 border-transparent hover:text-verde"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── tab cobranças ── */}
      {tab === "cobrancas" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="Recebido no mês"    value={fmt(totalPaid)}    sub={`${paid.length} cobranças pagas`}      color="#3A9B6F" icon={CheckCircle2} />
            <KpiCard label="Aguardando"         value={fmt(totalPending)} sub={`${pending.length} cobranças abertas`} color="#C4895A" icon={Clock}        />
            <KpiCard label="Vencidas"           value={fmt(totalOverdue)} sub={`${overdue.length} em atraso`}         color="#B05248" icon={XCircle}      />
            <KpiCard label="Taxa de conversão"  value={`${convRate}%`}    sub={`${charges.length} cobranças total`}   color="#4A8EC2" icon={TrendingUp}   />
          </div>

          {/* filtros */}
          <div className="bg-white border border-creme-200 rounded-2xl px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-48 border border-creme-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-gray-300 shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente ou descrição…"
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder-gray-300 text-gray-700" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-creme-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none bg-white">
              <option value="">Todos os status</option>
              <option value="paid">Pago</option>
              <option value="pending">Aguardando</option>
              <option value="overdue">Vencida</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}
              className="border border-creme-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none bg-white">
              <option value="">Todas as formas</option>
              <option value="pix">PIX</option>
              <option value="credit_card">Cartão</option>
              <option value="boleto">Boleto</option>
            </select>
            {(search || filterStatus || filterMethod) && (
              <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterMethod(""); }}
                className="text-xs text-gray-400 hover:text-verde flex items-center gap-1 transition">
                <X size={12} /> Limpar
              </button>
            )}
          </div>

          {/* tabela */}
          <div className="bg-white border border-creme-200 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-creme-200 bg-creme-100">
              {["Paciente / Descrição", "Valor", "Forma", "Vencimento", "Status", ""].map((h) => (
                <p key={h} className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{h}</p>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Receipt size={32} className="text-ambar opacity-40" />
                <p className="text-sm text-gray-400">Nenhuma cobrança encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EAE0]">
                {filtered.map((charge) => (
                  <div key={charge.id}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-x-4 gap-y-1 px-5 py-4 hover:bg-[#FAFAF8] transition items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{charge.patient}</p>
                      <p className="text-xs text-gray-400 truncate">{charge.description}</p>
                      {charge.origin && (
                        <span className="text-[10px] text-gray-400 bg-[#F0EAE0] px-1.5 py-0.5 rounded-full mt-0.5 inline-block">{charge.origin}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold font-mono text-verde-900">{fmt(charge.amount)}</p>
                      {charge.installments && (
                        <p className="text-[10px] text-gray-400 font-mono">{charge.installments}x de {fmt(charge.amount / charge.installments)}</p>
                      )}
                    </div>
                    <div><MethodBadge method={charge.method} /></div>
                    <div>
                      <p className="text-xs text-gray-600 font-mono">{fmtDate(charge.dueDate)}</p>
                      {charge.paidAt && <p className="text-[10px] text-sucesso font-mono">Pago {fmtDate(charge.paidAt)}</p>}
                    </div>
                    <div><StatusBadge status={charge.status} /></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetail(charge)}
                        className="w-8 h-8 rounded-xl border border-creme-200 hover:bg-creme-50 flex items-center justify-center text-gray-400 hover:text-verde transition">
                        <Eye size={13} />
                      </button>
                      {(charge.status === "PENDING" || charge.status === "pending" || charge.status === "OVERDUE" || charge.status === "overdue") && (
                        <button
                          onClick={() => simulateCharge(charge.id)}
                          title="Simular pagamento (sandbox)"
                          className="w-8 h-8 rounded-xl border border-ambar-300 hover:bg-ambar-50 flex items-center justify-center text-ambar-500 hover:text-ambar-600 transition">
                          <Zap size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── tab saldo ── */}
      {tab === "saldo" && <SaldoTab />}

      {/* ── tab config ── */}
      {tab === "config" && <ConfigTab />}

      {/* modais */}
      {showNew && (
        <NewChargeModal onClose={() => setShowNew(false)} onSave={(c) => setCharges((prev) => [c, ...prev])} />
      )}
      {detail && (
        <ChargeDetailModal charge={detail} onClose={() => setDetail(null)} onSimulate={simulateCharge} />
      )}
    </MainLayout>
  );
}
