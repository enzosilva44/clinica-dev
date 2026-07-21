import { useEffect, useState } from "react";
import {
  Plus, X, Trash2, Pencil, Users, Star,
  Bell, CheckCircle, AlertTriangle, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import { Card, Button } from "../components/ui";
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
      toast.error(mensagemDeErro(e, "carregar os dados do clube"));
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
      toast.error(mensagemDeErro(e, "salvar o plano"));
    }
  }

  async function deletePlan(id) {
    try {
      await api.delete(`/club/plans/${id}`);
      toast.success("Plano removido");
      load();
    } catch (e) {
      toast.error(mensagemDeErro(e, "remover o plano"));
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
      toast.error(mensagemDeErro(e, "adicionar o membro"));
    }
  }

  async function changeMemberStatus(id, status) {
    try {
      await api.patch(`/club/members/${id}/status`, { status });
      toast.success("Status atualizado");
      load();
    } catch (e) {
      toast.error(mensagemDeErro(e, "atualizar o status"));
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
      toast.error(mensagemDeErro(e, "registrar a aplicação"));
    }
  }

  const alertsCount = alerts.length;

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Clube</h1>
          <p className="text-gray-500 mt-1">Planos, membros e acompanhamento de procedimentos</p>
        </div>
        <div className="flex gap-3">
          {tab === "planos" && (
            <Button size="md" onClick={() => setShowPlanModal(true)}>
              <Plus size={16} /> Novo plano
            </Button>
          )}
          {tab === "membros" && (
            <Button size="md" onClick={() => setShowMemberModal(true)}>
              <Plus size={16} /> Novo membro
            </Button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b-[1.5px] border-creme-200 mb-6">
        {[
          { key: "planos", icon: Star, label: "Planos" },
          { key: "membros", icon: Users, label: "Membros" },
          { key: "alertas", icon: Bell, label: `Alertas${alertsCount > 0 ? ` (${alertsCount})` : ""}` },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 mb-[-1.5px] transition ${
              tab === key ? "text-verde border-verde" : "text-gray-500 border-transparent hover:text-verde-900"
            }`}
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
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
                  <Star size={28} className="text-ambar" />
                </div>
                <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum plano cadastrado</h2>
                <p className="text-gray-500 mb-6 max-w-xs">Crie os planos do clube com os procedimentos incluídos.</p>
                <Button onClick={() => setShowPlanModal(true)}>
                  <Plus size={18} /> Novo plano
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((plan) => (
                  <Card key={plan.id} className="bg-white! p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-verde-900">{plan.name}</h2>
                        {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openEditPlan(plan)} className="text-verde hover:text-verde-900 transition"><Pencil size={15} /></button>
                        <button onClick={() => deletePlan(plan.id)} className="text-erro hover:text-erro/70 transition"><Trash2 size={15} /></button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-verde-900 font-mono">{fmt(plan.price)}</p>
                        <p className="text-xs text-gray-500">{plan.billingCycle}</p>
                      </div>
                      <div className="bg-verde-50 text-verde text-xs font-bold px-2.5 py-1 rounded-full">
                        {plan._count?.members ?? 0} membros
                      </div>
                    </div>

                    <div className="border-t border-creme-200 pt-3.5 space-y-1.5">
                      <p className="text-[11px] font-bold tracking-wide text-gray-400 uppercase mb-2">Inclusos</p>
                      {plan.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-creme-50 border border-creme-200 rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-verde-900">{item.quantity}x {item.procedureName}</span>
                          <span className="text-gray-400 text-xs font-mono">a cada {item.intervalMonths}m</span>
                        </div>
                      ))}
                      {plan.items.length === 0 && <p className="text-xs text-gray-400">Sem procedimentos cadastrados</p>}
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* ── TAB MEMBROS ── */}
          {tab === "membros" && (
            members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
                  <Users size={28} className="text-ambar" />
                </div>
                <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum membro cadastrado</h2>
                <p className="text-gray-500 mb-6 max-w-xs">Associe pacientes aos planos do clube.</p>
                <Button onClick={() => setShowMemberModal(true)}>
                  <Plus size={18} /> Novo membro
                </Button>
              </div>
            ) : (
              <Card className="bg-white! p-0 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-creme-100">
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Paciente</th>
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Plano</th>
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Adesão</th>
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Validade</th>
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Pagamento</th>
                      <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-t border-creme-200 hover:bg-creme-50 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-verde-900 text-sm">{m.patient.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{m.patient.phone}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-verde-900">{m.plan.name}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 font-mono">{new Date(m.startDate).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 font-mono">{m.endDate ? new Date(m.endDate).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{m.paymentMethod || "—"}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={m.status}
                            onChange={(e) => changeMemberStatus(m.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 font-bold cursor-pointer ${
                              m.status === "ativo" ? "bg-verde-50 text-verde" :
                              m.status === "suspenso" ? "bg-[#FAF0E4] text-ambar-600" :
                              "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs text-gray-400">{m.applications.length} aplic.</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
            )
          )}

          {/* ── TAB ALERTAS ── */}
          {tab === "alertas" && (
            alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
                  <CheckCircle size={28} className="text-verde" />
                </div>
                <h2 className="text-xl font-semibold text-verde-900 mb-2">Tudo em dia!</h2>
                <p className="text-gray-500">Nenhum procedimento vencendo nos próximos 30 dias.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, i) => (
                  <Card
                    key={i}
                    className={`bg-white! flex items-center justify-between px-5 py-4 ${
                      alert.isOverdue
                        ? "border-[#EBCBC7]!"
                        : alert.daysUntilDue <= 7
                        ? "border-[#EDDCC7]!"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {alert.isOverdue
                        ? <AlertTriangle size={20} className="text-erro shrink-0" />
                        : alert.daysUntilDue <= 7
                        ? <Clock size={20} className="text-ambar-600 shrink-0" />
                        : <Bell size={20} className="text-verde shrink-0" />
                      }
                      <div>
                        <p className="font-semibold text-verde-900 text-sm">{alert.patientName}</p>
                        <p className="text-xs text-gray-500">{alert.planName} — {alert.quantity}x {alert.procedureName}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">
                          {alert.lastAppliedAt
                            ? `Última: ${new Date(alert.lastAppliedAt).toLocaleDateString("pt-BR")}`
                            : "Nunca aplicado"}
                          {" · "}Próxima: {new Date(alert.nextDueAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-mono ${
                        alert.isOverdue ? "bg-[#F8E4E2] text-erro" :
                        alert.daysUntilDue <= 7 ? "bg-[#FAF0E4] text-ambar-600" :
                        "bg-creme-100 text-verde"
                      }`}>
                        {daysLabel(alert.daysUntilDue)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => { setAppAlert(alert); setAppDate(new Date().toISOString().slice(0, 10)); setAppNotes(""); setShowAppModal(true); }}
                      >
                        Registrar
                      </Button>
                    </div>
                  </Card>
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
              <h2 className="text-xl font-bold text-verde-900">{editingPlan ? "Editar plano" : "Novo plano"}</h2>
              <button onClick={closePlanModal} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
            </div>
            <form onSubmit={savePlan} className="space-y-4">
              <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Nome do plano" required className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
              <textarea value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Descrição (opcional)" rows={2} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Preço (R$)</label>
                  <input value={planPrice} onChange={e => setPlanPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0,00" required className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Ciclo de cobrança</label>
                  <select value={planCycle} onChange={e => setPlanCycle(e.target.value)} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20">
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-verde-900">Procedimentos incluídos</p>
                  <button type="button" onClick={() => setPlanItems([...planItems, { procedureName: "", quantity: 1, intervalMonths: 12 }])} className="text-xs font-semibold text-verde border border-ambar px-2.5 py-1 rounded-lg hover:bg-creme-100 transition">
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {planItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={item.procedureName} onChange={e => updatePlanItem(i, "procedureName", e.target.value)} placeholder="Ex: Toxina Botulínica" className="col-span-5 border border-ambar rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
                      <div className="col-span-2 relative">
                        <input value={item.quantity} onChange={e => updatePlanItem(i, "quantity", e.target.value)} type="number" min="1" placeholder="Qtd" className="w-full border border-ambar rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
                      </div>
                      <div className="col-span-4">
                        <select value={item.intervalMonths} onChange={e => updatePlanItem(i, "intervalMonths", Number(e.target.value))} className="w-full border border-ambar rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20">
                          <option value={1}>Todo mês</option>
                          <option value={3}>3 em 3 meses</option>
                          <option value={6}>6 em 6 meses</option>
                          <option value={12}>1x ao ano</option>
                        </select>
                      </div>
                      <button type="button" onClick={() => setPlanItems(planItems.filter((_, j) => j !== i))} className="col-span-1 text-erro hover:text-erro/70 transition flex justify-center">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" size="md" onClick={closePlanModal}>Cancelar</Button>
                <Button type="submit" size="md">{editingPlan ? "Salvar" : "Criar plano"}</Button>
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
              <h2 className="text-xl font-bold text-verde-900">Novo membro</h2>
              <button onClick={closeMemberModal} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
            </div>
            <form onSubmit={saveMember} className="space-y-4">
              <div className="relative">
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Paciente</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => searchPatients(e.target.value)}
                  onFocus={() => { if (patientResults.length) setShowPatientDrop(true); }}
                  placeholder="Digite o nome do paciente…"
                  autoComplete="off"
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
                {/* input oculto para garantir validação required do form */}
                <input type="text" value={memberPatientId} required readOnly tabIndex={-1}
                  className="sr-only" aria-hidden="true" />
                {showPatientDrop && patientResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-creme-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-creme-50 transition flex flex-col"
                      >
                        <span className="font-medium text-verde-900">{p.name}</span>
                        {p.phone && <span className="text-xs text-gray-400">{p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {showPatientDrop && patientSearch.trim() && patientResults.length === 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-creme-200 rounded-xl shadow-lg px-3 py-2.5 text-sm text-gray-400">
                    Nenhum paciente encontrado
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Plano</label>
                <select value={memberPlanId} onChange={e => setMemberPlanId(e.target.value)} required className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20">
                  <option value="">Selecione</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}/{p.billingCycle}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Data de adesão</label>
                  <input type="date" value={memberStartDate} onChange={e => setMemberStartDate(e.target.value)} required className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Validade (opcional)</label>
                  <input type="date" value={memberEndDate} onChange={e => setMemberEndDate(e.target.value)} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Forma de pagamento</label>
                <select value={memberPayment} onChange={e => setMemberPayment(e.target.value)} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20">
                  <option value="">Selecione</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <textarea value={memberNotes} onChange={e => setMemberNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" size="md" onClick={closeMemberModal}>Cancelar</Button>
                <Button type="submit" size="md">Adicionar</Button>
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
              <h2 className="text-lg font-bold text-verde-900">Registrar aplicação</h2>
              <button onClick={() => setShowAppModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-verde-900">{appAlert.patientName}</span> — {appAlert.quantity}x {appAlert.procedureName}
            </p>
            <form onSubmit={saveApplication} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Data da aplicação</label>
                <input type="date" value={appDate} onChange={e => setAppDate(e.target.value)} required className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
              </div>
              <textarea value={appNotes} onChange={e => setAppNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20" />
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="secondary" size="md" onClick={() => setShowAppModal(false)}>Cancelar</Button>
                <Button type="submit" size="md">Confirmar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
