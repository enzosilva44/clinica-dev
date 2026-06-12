import { useEffect, useState } from "react";
import {
  Plus, X, Trash2, Pencil, Users, Star,
  Bell, CheckCircle, AlertTriangle, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

const BILLING_CYCLES = ["mensal", "trimestral", "semestral", "anual"];
const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"];
const STATUS_OPTIONS = ["ativo", "suspenso", "cancelado"];

function fmt(v) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysLabel(days) {
  if (days < 0) return `${Math.abs(days)}d em atraso`;
  if (days === 0) return "Vence hoje";
  return `${days}d`;
}

export default function Clube() {
  const [tab, setTab] = useState("planos");
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca de paciente por nome (sem carregar lista do banco)
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // modal plano
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planCycle, setPlanCycle] = useState("mensal");
  const [planItems, setPlanItems] = useState([{ procedureName: "", quantity: 1, intervalMonths: 12 }]);

  // modal membro
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberPatientId, setMemberPatientId] = useState("");
  const [memberPlanId, setMemberPlanId] = useState("");
  const [memberStartDate, setMemberStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [memberEndDate, setMemberEndDate] = useState("");
  const [memberPayment, setMemberPayment] = useState("");
  const [memberNotes, setMemberNotes] = useState("");

  // modal registrar aplicação
  const [showAppModal, setShowAppModal] = useState(false);
  const [appAlert, setAppAlert] = useState(null);
  const [appDate, setAppDate] = useState(new Date().toISOString().slice(0, 10));
  const [appNotes, setAppNotes] = useState("");

  async function searchPatients(q) {
    setPatientSearch(q);
    setMemberPatientId(""); // limpa seleção ao digitar
    if (q.trim().length < 1) { setPatientResults([]); setShowPatientDrop(false); return; }
    try {
      const res = await api.get("/patients", { params: { search: q, status: "active" } });
      setPatientResults(res.data.data ?? []);
      setShowPatientDrop(true);
    } catch { setPatientResults([]); }
  }

  function selectPatient(p) {
    setMemberPatientId(p.id);
    setPatientSearch(p.name);
    setShowPatientDrop(false);
  }

  async function load() {
    try {
      const [plansRes, membersRes, alertsRes] = await Promise.all([
        api.get("/club/plans"),
        api.get("/club/members"),
        api.get("/club/alerts"),
      ]);
      setPlans(plansRes.data);
      setMembers(membersRes.data);
      setAlerts(alertsRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados do clube");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Planos ──
  async function savePlan(e) {
    e.preventDefault();
    try {
      const payload = { name: planName, description: planDesc, price: planPrice, billingCycle: planCycle, items: planItems.filter(i => i.procedureName) };
      if (editingPlan) {
        await api.put(`/club/plans/${editingPlan.id}`, payload);
        toast.success("Plano atualizado!");
      } else {
        await api.post("/club/plans", payload);
        toast.success("Plano criado!");
      }
      closePlanModal();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao salvar plano");
    }
  }

  async function deletePlan(id) {
    try {
      await api.delete(`/club/plans/${id}`);
      toast.success("Plano removido");
      load();
    } catch (e) {
      toast.error("Erro ao remover plano");
    }
  }

  function openEditPlan(plan) {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanDesc(plan.description || "");
    setPlanPrice(String(plan.price));
    setPlanCycle(plan.billingCycle);
    setPlanItems(plan.items.length ? plan.items.map(i => ({ procedureName: i.procedureName, quantity: i.quantity, intervalMonths: i.intervalMonths })) : [{ procedureName: "", quantity: 1, intervalMonths: 12 }]);
    setShowPlanModal(true);
  }

  function closePlanModal() {
    setShowPlanModal(false);
    setEditingPlan(null);
    setPlanName(""); setPlanDesc(""); setPlanPrice(""); setPlanCycle("mensal");
    setPlanItems([{ procedureName: "", quantity: 1, intervalMonths: 12 }]);
  }

  function updatePlanItem(i, field, val) {
    const updated = [...planItems];
    updated[i] = { ...updated[i], [field]: val };
    setPlanItems(updated);
  }

  // ── Membros ──
  async function saveMember(e) {
    e.preventDefault();
    try {
      await api.post("/club/members", {
        patientId: memberPatientId,
        planId: memberPlanId,
        startDate: memberStartDate,
        endDate: memberEndDate || null,
        paymentMethod: memberPayment,
        notes: memberNotes,
      });
      toast.success("Membro adicionado!");
      closeMemberModal();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao adicionar membro");
    }
  }

  async function changeMemberStatus(id, status) {
    try {
      await api.patch(`/club/members/${id}/status`, { status });
      toast.success("Status atualizado");
      load();
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  }

  function closeMemberModal() {
    setShowMemberModal(false);
    setMemberPatientId(""); setMemberPlanId(""); setMemberStartDate(new Date().toISOString().slice(0, 10));
    setMemberEndDate(""); setMemberPayment(""); setMemberNotes("");
    setPatientSearch(""); setPatientResults([]); setShowPatientDrop(false);
  }

  // ── Aplicações ──
  async function saveApplication(e) {
    e.preventDefault();
    try {
      await api.post(`/club/members/${appAlert.memberId}/applications`, {
        planItemId: appAlert.planItemId,
        appliedAt: appDate,
        notes: appNotes,
      });
      toast.success("Aplicação registrada!");
      setShowAppModal(false);
      setAppAlert(null);
      setAppNotes("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao registrar aplicação");
    }
  }

  const alertsCount = alerts.length;

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1F4D46]">Clube</h1>
          <p className="text-gray-500 mt-1">Planos, membros e acompanhamento de procedimentos</p>
        </div>
        <div className="flex gap-3">
          {tab === "planos" && (
            <button onClick={() => setShowPlanModal(true)} className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition">
              <Plus size={16} /> Novo plano
            </button>
          )}
          {tab === "membros" && (
            <button onClick={() => setShowMemberModal(true)} className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition">
              <Plus size={16} /> Novo membro
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-6 bg-[#E8E0D2] p-1 rounded-xl w-fit">
        {[
          { key: "planos", icon: Star, label: "Planos" },
          { key: "membros", icon: Users, label: "Membros" },
          { key: "alertas", icon: Bell, label: `Alertas${alertsCount > 0 ? ` (${alertsCount})` : ""}` },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === key ? "bg-white text-[#1F4D46] shadow-sm" : "text-gray-500 hover:text-[#1F4D46]"}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── TAB PLANOS ── */}
          {tab === "planos" && (
            plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Star size={48} className="text-[#C2A56B] mb-4" />
                <h2 className="text-xl font-semibold text-[#1F4D46] mb-2">Nenhum plano cadastrado</h2>
                <p className="text-gray-500 mb-6">Crie os planos do clube com os procedimentos incluídos.</p>
                <button onClick={() => setShowPlanModal(true)} className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-3 rounded-xl flex items-center gap-2 transition">
                  <Plus size={18} /> Novo plano
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((plan) => (
                  <div key={plan.id} className="bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-[#1F4D46]">{plan.name}</h2>
                        {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditPlan(plan)} className="text-[#1F4D46] hover:text-[#285A50]"><Pencil size={15} /></button>
                        <button onClick={() => deletePlan(plan.id)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-[#1F4D46]">{fmt(plan.price)}</p>
                        <p className="text-xs text-gray-500">{plan.billingCycle}</p>
                      </div>
                      <div className="bg-[#1F4D46] text-white text-xs px-2.5 py-1 rounded-full">
                        {plan._count?.members ?? 0} membros
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {plan.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white border border-[#D8CDB9] rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-[#1F4D46]">{item.quantity}x {item.procedureName}</span>
                          <span className="text-gray-400 text-xs">a cada {item.intervalMonths}m</span>
                        </div>
                      ))}
                      {plan.items.length === 0 && <p className="text-xs text-gray-400">Sem procedimentos cadastrados</p>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── TAB MEMBROS ── */}
          {tab === "membros" && (
            members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Users size={48} className="text-[#C2A56B] mb-4" />
                <h2 className="text-xl font-semibold text-[#1F4D46] mb-2">Nenhum membro cadastrado</h2>
                <p className="text-gray-500 mb-6">Associe pacientes aos planos do clube.</p>
                <button onClick={() => setShowMemberModal(true)} className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-3 rounded-xl flex items-center gap-2 transition">
                  <Plus size={18} /> Novo membro
                </button>
              </div>
            ) : (
              <div className="bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#E8E0D2]">
                    <tr>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Paciente</th>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Plano</th>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Adesão</th>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Validade</th>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Pagamento</th>
                      <th className="text-left p-4 text-[#1F4D46] text-sm font-semibold">Status</th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-t border-[#D8CDB9] hover:bg-[#F3EEE5] transition">
                        <td className="p-4">
                          <p className="font-medium text-[#1F4D46] text-sm">{m.patient.name}</p>
                          <p className="text-xs text-gray-400">{m.patient.phone}</p>
                        </td>
                        <td className="p-4 text-sm text-[#1F4D46]">{m.plan.name}</td>
                        <td className="p-4 text-sm text-gray-500">{new Date(m.startDate).toLocaleDateString("pt-BR")}</td>
                        <td className="p-4 text-sm text-gray-500">{m.endDate ? new Date(m.endDate).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-4 text-sm text-gray-500">{m.paymentMethod || "—"}</td>
                        <td className="p-4">
                          <select
                            value={m.status}
                            onChange={(e) => changeMemberStatus(m.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${
                              m.status === "ativo" ? "bg-green-100 text-green-700" :
                              m.status === "suspenso" ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-xs text-gray-400">{m.applications.length} aplic.</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── TAB ALERTAS ── */}
          {tab === "alertas" && (
            alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <CheckCircle size={48} className="text-[#1F4D46] mb-4" />
                <h2 className="text-xl font-semibold text-[#1F4D46] mb-2">Tudo em dia!</h2>
                <p className="text-gray-500">Nenhum procedimento vencendo nos próximos 30 dias.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-2xl px-5 py-4 border ${
                      alert.isOverdue
                        ? "bg-red-50 border-red-200"
                        : alert.daysUntilDue <= 7
                        ? "bg-amber-50 border-amber-200"
                        : "bg-[#F5F1EA] border-[#D8CDB9]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {alert.isOverdue
                        ? <AlertTriangle size={20} className="text-red-500 shrink-0" />
                        : alert.daysUntilDue <= 7
                        ? <Clock size={20} className="text-amber-500 shrink-0" />
                        : <Bell size={20} className="text-[#1F4D46] shrink-0" />
                      }
                      <div>
                        <p className="font-semibold text-[#1F4D46] text-sm">{alert.patientName}</p>
                        <p className="text-xs text-gray-500">{alert.planName} — {alert.quantity}x {alert.procedureName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {alert.lastAppliedAt
                            ? `Última: ${new Date(alert.lastAppliedAt).toLocaleDateString("pt-BR")}`
                            : "Nunca aplicado"}
                          {" · "}Próxima: {new Date(alert.nextDueAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        alert.isOverdue ? "bg-red-100 text-red-700" :
                        alert.daysUntilDue <= 7 ? "bg-amber-100 text-amber-700" :
                        "bg-[#E8E0D2] text-[#1F4D46]"
                      }`}>
                        {daysLabel(alert.daysUntilDue)}
                      </span>
                      <button
                        onClick={() => { setAppAlert(alert); setAppDate(new Date().toISOString().slice(0, 10)); setAppNotes(""); setShowAppModal(true); }}
                        className="bg-[#1F4D46] hover:bg-[#285A50] text-white text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* ── MODAL PLANO ── */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1F4D46]">{editingPlan ? "Editar plano" : "Novo plano"}</h2>
              <button onClick={closePlanModal}><X size={20} /></button>
            </div>
            <form onSubmit={savePlan} className="space-y-4">
              <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Nome do plano" required className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
              <textarea value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Descrição (opcional)" rows={2} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Preço (R$)</label>
                  <input value={planPrice} onChange={e => setPlanPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0,00" required className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Ciclo de cobrança</label>
                  <select value={planCycle} onChange={e => setPlanCycle(e.target.value)} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm">
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#1F4D46]">Procedimentos incluídos</p>
                  <button type="button" onClick={() => setPlanItems([...planItems, { procedureName: "", quantity: 1, intervalMonths: 12 }])} className="text-xs text-[#1F4D46] border border-[#C2A56B] px-2.5 py-1 rounded-lg hover:bg-[#E8E0D2]">
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {planItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={item.procedureName} onChange={e => updatePlanItem(i, "procedureName", e.target.value)} placeholder="Ex: Toxina Botulínica" className="col-span-5 border border-[#C2A56B] rounded-lg p-2 text-sm" />
                      <div className="col-span-2 relative">
                        <input value={item.quantity} onChange={e => updatePlanItem(i, "quantity", e.target.value)} type="number" min="1" placeholder="Qtd" className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm" />
                      </div>
                      <div className="col-span-4">
                        <select value={item.intervalMonths} onChange={e => updatePlanItem(i, "intervalMonths", Number(e.target.value))} className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm">
                          <option value={1}>Todo mês</option>
                          <option value={3}>3 em 3 meses</option>
                          <option value={6}>6 em 6 meses</option>
                          <option value={12}>1x ao ano</option>
                        </select>
                      </div>
                      <button type="button" onClick={() => setPlanItems(planItems.filter((_, j) => j !== i))} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closePlanModal} className="border border-[#C2A56B] px-4 py-2 rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-2 rounded-xl text-sm">{editingPlan ? "Salvar" : "Criar plano"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL MEMBRO ── */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#1F4D46]">Novo membro</h2>
              <button onClick={closeMemberModal}><X size={20} /></button>
            </div>
            <form onSubmit={saveMember} className="space-y-4">
              <div className="relative">
                <label className="text-xs text-gray-500 block mb-1">Paciente</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => searchPatients(e.target.value)}
                  onFocus={() => { if (patientResults.length) setShowPatientDrop(true); }}
                  placeholder="Digite o nome do paciente…"
                  autoComplete="off"
                  className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm focus:outline-none focus:border-[#1F4D46]"
                />
                {/* input oculto para garantir validação required do form */}
                <input type="text" value={memberPatientId} required readOnly tabIndex={-1}
                  className="sr-only" aria-hidden="true" />
                {showPatientDrop && patientResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D8CDB9] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#F5F1EA] transition flex flex-col"
                      >
                        <span className="font-medium text-[#1F4D46]">{p.name}</span>
                        {p.phone && <span className="text-xs text-gray-400">{p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {showPatientDrop && patientSearch.trim() && patientResults.length === 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D8CDB9] rounded-xl shadow-lg px-3 py-2.5 text-sm text-gray-400">
                    Nenhum paciente encontrado
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plano</label>
                <select value={memberPlanId} onChange={e => setMemberPlanId(e.target.value)} required className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm">
                  <option value="">Selecione</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}/{p.billingCycle}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data de adesão</label>
                  <input type="date" value={memberStartDate} onChange={e => setMemberStartDate(e.target.value)} required className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Validade (opcional)</label>
                  <input type="date" value={memberEndDate} onChange={e => setMemberEndDate(e.target.value)} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Forma de pagamento</label>
                <select value={memberPayment} onChange={e => setMemberPayment(e.target.value)} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm">
                  <option value="">Selecione</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <textarea value={memberNotes} onChange={e => setMemberNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeMemberModal} className="border border-[#C2A56B] px-4 py-2 rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-2 rounded-xl text-sm">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL REGISTRAR APLICAÇÃO ── */}
      {showAppModal && appAlert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1F4D46]">Registrar aplicação</h2>
              <button onClick={() => setShowAppModal(false)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-[#1F4D46]">{appAlert.patientName}</span> — {appAlert.quantity}x {appAlert.procedureName}
            </p>
            <form onSubmit={saveApplication} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Data da aplicação</label>
                <input type="date" value={appDate} onChange={e => setAppDate(e.target.value)} required className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
              </div>
              <textarea value={appNotes} onChange={e => setAppNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} className="w-full border border-[#C2A56B] rounded-xl p-3 text-sm" />
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowAppModal(false)} className="border border-[#C2A56B] px-4 py-2 rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="bg-[#1F4D46] hover:bg-[#285A50] text-white px-5 py-2 rounded-xl text-sm">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
