import { useEffect, useState } from "react";
import {
  Plus, X, CheckCircle, XCircle, Trash2,
  TrendingUp, TrendingDown, DollarSign, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"];

function fmt(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function Financeiro() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState({ receitas: 0, despesas: 0, saldo: 0, pendentes: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal novo lançamento
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState("receita");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dueDate, setDueDate] = useState("");

  // modal aprovar pendente
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingTx, setApprovingTx] = useState(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveMethod, setApproveMethod] = useState("");

  // filtro de status
  const [statusFilter, setStatusFilter] = useState("todos");

  async function load() {
    try {
      const [summaryRes, txRes] = await Promise.all([
        api.get("/financial/summary", { params: { month } }),
        api.get("/financial", { params: { month: statusFilter === "pendente" ? undefined : month } }),
      ]);
      setSummary(summaryRes.data);
      setTransactions(txRes.data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [month, statusFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post("/financial", { type, description, amount, paymentMethod, dueDate });
      toast.success("Lançamento criado!");
      resetForm();
      setShowModal(false);
      load();
    } catch (error) {
      toast.error("Erro ao criar lançamento");
    }
  }

  async function handleApprove(e) {
    e.preventDefault();
    try {
      await api.patch(`/financial/${approvingTx.id}/approve`, {
        amount: approveAmount,
        paymentMethod: approveMethod,
      });
      toast.success("Recebimento confirmado!");
      setShowApproveModal(false);
      setApprovingTx(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao aprovar");
    }
  }

  async function handleCancel(id) {
    try {
      await api.patch(`/financial/${id}/cancel`);
      toast.success("Transação cancelada");
      load();
    } catch (error) {
      toast.error("Erro ao cancelar");
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/financial/${id}`);
      toast.success("Lançamento removido");
      load();
    } catch (error) {
      toast.error("Erro ao remover");
    }
  }

  function openApprove(tx) {
    setApprovingTx(tx);
    setApproveAmount(tx.amount > 0 ? String(tx.amount) : "");
    setApproveMethod("");
    setShowApproveModal(true);
  }

  function resetForm() {
    setType("receita");
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setDueDate("");
  }

  const filtered = statusFilter === "todos"
    ? transactions
    : transactions.filter((t) => t.status === statusFilter);

  const pendentes = transactions.filter((t) => t.status === "pendente");

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#314D3E]">Financeiro</h1>
          <p className="text-gray-500 mt-1">Receitas, despesas e fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-[#D6C1A3] rounded-xl px-3 py-2 text-sm text-[#314D3E]"
          />
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-sm"
          >
            <Plus size={16} />
            Novo lançamento
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* DRE CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#314D3E] rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} />
                <p className="text-sm font-medium">Receitas</p>
              </div>
              <p className="text-3xl font-bold">{fmt(summary.receitas)}</p>
            </div>
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3 text-red-500">
                <TrendingDown size={18} />
                <p className="text-sm font-medium">Despesas</p>
              </div>
              <p className="text-3xl font-bold text-red-500">{fmt(summary.despesas)}</p>
            </div>
            <div className={`rounded-2xl p-5 ${summary.saldo >= 0 ? "bg-[#465634] text-white" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={18} />
                <p className="text-sm font-medium">Saldo</p>
              </div>
              <p className={`text-3xl font-bold ${summary.saldo < 0 ? "text-red-600" : ""}`}>
                {fmt(summary.saldo)}
              </p>
            </div>
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3 text-amber-600">
                <Clock size={18} />
                <p className="text-sm font-medium">Pendentes</p>
              </div>
              <p className="text-3xl font-bold text-amber-600">{summary.pendentes}</p>
            </div>
          </div>

          {/* APROVAÇÕES PENDENTES */}
          {pendentes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-amber-600" />
                <h2 className="font-semibold text-amber-800">
                  {pendentes.length} aguardando aprovação
                </h2>
              </div>
              <div className="space-y-2">
                {pendentes.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-[#314D3E] text-sm">{tx.description}</p>
                      {tx.patient && (
                        <p className="text-xs text-gray-500">{tx.patient.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-[#314D3E]">
                        {tx.amount > 0 ? fmt(tx.amount) : "—"}
                      </span>
                      <button
                        onClick={() => openApprove(tx)}
                        className="bg-[#314D3E] hover:bg-[#465634] text-white text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => handleCancel(tx.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILTRO + TABELA */}
          <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5D8C5]">
              <h2 className="font-semibold text-[#314D3E]">Lançamentos</h2>
              <div className="flex gap-2">
                {["todos", "confirmado", "pendente", "cancelado"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg capitalize transition ${
                      statusFilter === s
                        ? "bg-[#314D3E] text-white"
                        : "border border-[#D6C1A3] text-gray-600 hover:bg-[#EFE7DA]"
                    }`}
                  >
                    {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                Nenhum lançamento encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#EFE7DA]">
                  <tr>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Descrição</th>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Tipo</th>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Valor</th>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Forma</th>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Status</th>
                    <th className="text-left p-4 text-[#314D3E] text-sm font-semibold">Data</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="border-t border-[#E5D8C5] hover:bg-[#F3EEE5] transition">
                      <td className="p-4">
                        <p className="text-sm font-medium text-[#314D3E]">{tx.description}</p>
                        {tx.patient && (
                          <p className="text-xs text-gray-400">{tx.patient.name}</p>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          tx.type === "receita"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {tx.type === "receita" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-sm text-[#314D3E]">
                        {tx.amount > 0 ? fmt(tx.amount) : "—"}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {tx.paymentMethod || "—"}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-end">
                          {tx.status === "pendente" && (
                            <button onClick={() => openApprove(tx)} className="text-[#314D3E] hover:text-[#465634]">
                              <CheckCircle size={16} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(tx.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL NOVO LANÇAMENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#314D3E]">Novo lançamento</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* TIPO TOGGLE */}
              <div className="flex rounded-xl border border-[#D6C1A3] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setType("receita")}
                  className={`flex-1 py-2.5 text-sm font-medium transition ${
                    type === "receita" ? "bg-[#314D3E] text-white" : "bg-white text-gray-500"
                  }`}
                >
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setType("despesa")}
                  className={`flex-1 py-2.5 text-sm font-medium transition ${
                    type === "despesa" ? "bg-red-500 text-white" : "bg-white text-gray-500"
                  }`}
                >
                  Despesa
                </button>
              </div>

              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                required
                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Valor (R$)"
                type="number"
                min="0"
                step="0.01"
                required
                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
              />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
              >
                <option value="">Forma de pagamento</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm">
                  Cancelar
                </button>
                <button type="submit" className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2 rounded-xl text-sm">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL APROVAR PENDENTE */}
      {showApproveModal && approvingTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-6">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#314D3E]">Confirmar recebimento</h2>
              <button onClick={() => setShowApproveModal(false)}><X size={20} /></button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Procedimento: <span className="font-medium text-[#314D3E]">{approvingTx.description}</span>
            </p>

            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Valor recebido (R$)</label>
                <input
                  value={approveAmount}
                  onChange={(e) => setApproveAmount(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  required
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Forma de pagamento</label>
                <select
                  value={approveMethod}
                  onChange={(e) => setApproveMethod(e.target.value)}
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowApproveModal(false)} className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm">
                  Cancelar
                </button>
                <button type="submit" className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2 rounded-xl text-sm">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function StatusBadge({ status }) {
  const map = {
    pendente: "bg-amber-100 text-amber-700",
    confirmado: "bg-green-100 text-green-700",
    cancelado: "bg-gray-100 text-gray-500",
  };
  const labels = { pendente: "Pendente", confirmado: "Confirmado", cancelado: "Cancelado" };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${map[status] || map.cancelado}`}>
      {labels[status] || status}
    </span>
  );
}
