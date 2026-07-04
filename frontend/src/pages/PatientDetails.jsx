import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles, Cake, CalendarDays, ClipboardList, TrendingUp, TrendingDown, Users, FileText, Download, Trash2, Eye, Send, Plus, PartyPopper, Check, AlertTriangle } from "lucide-react";
import { getAlertLevel } from "../components/patient/alertLevels";
import MainLayout from "../layouts/MainLayout";
import { Card } from "../components/ui";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";
import ProcedureMapTab from "../components/procedure-map/ProcedureMapTab";
import AnamnesisTab from "../components/anamnesis/AnamnesisTab";
import SigningModal from "../components/documents/SigningModal";
import PatientPhotos from "../components/patient/PatientPhotos";

export default function PatientDetails() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [patient, setPatient] =
    useState(null);

  const [evolutions, setEvolutions] =
    useState([]);

  const [appointments, setAppointments] =
    useState([]);

  const [procedures, setProcedures] = useState([]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [clinicalSubTab, setClinicalSubTab] = useState("evolucao");
  const [aiSummaryAt, setAiSummaryAt] = useState(null);

  const [showEvolutionForm, setShowEvolutionForm] = useState(false);

  const [selectedProcedureId, setSelectedProcedureId] = useState("");
  const [procedure, setProcedure] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState([]);
  const [aiSummary, setAiSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [patientStats, setPatientStats] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [patientDocs, setPatientDocs] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [signingDoc, setSigningDoc] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [savingBudget, setSavingBudget] = useState(false);
  const budgetKeyRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState(() => ({
    title: "",
    validUntil: "",
    discount: 0,
    observations: "",
    txPaymentMethod: "",
    txInstallments: "1",
    txDueDate: "",
    txNotes: "",
    items: [
      {
        procedureId: "",
        procedureName: "",
        quantity: 1,
        unitPrice: 0,
        observation: "",
      },
    ],
  }));

  async function loadSavedSummary() {
    try {
      const res = await api.get(`/ai/patient-summary/${id}`);
      if (res.data.summary) {
        setAiSummary(res.data.summary);
        setAiSummaryAt(res.data.updatedAt);
      }
    } catch { /* silencioso */ }
  }

  async function generateSummary() {
    setLoadingSummary(true);
    try {
      const res = await api.post(`/ai/patient-summary/${id}`);
      setAiSummary(res.data.summary);
      setAiSummaryAt(new Date().toISOString());
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao gerar resumo");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function generateEvolutionDraft() {
    if (!procedure) return;
    setLoadingDraft(true);
    try {
      const res = await api.post("/ai/evolution-draft", {
        procedureName: procedure,
        dose: materials,
        notes: description,
        patientName: patient?.name,
      });
      setDescription(res.data.draft);
    } catch (error) {
      toast.error("Erro ao gerar descrição");
    } finally {
      setLoadingDraft(false);
    }
  }

  async function loadPatient() {
    try {
      const response = await api.get(
        `/patients/${id}`
      );

      setPatient(response.data);
    } catch (error) {
      console.error(error);

      toast.error("Erro ao carregar paciente");
    }
  }

  async function loadEvolutions() {
    try {
      const response = await api.get(`/evolutions/patient/${id}`);
      setEvolutions(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadAppointments() {
    try {
      const response = await api.get(`/appointments/patient/${id}`);
      setAppointments(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadProcedures() {
    try {
      const response = await api.get("/procedures");
      setProcedures(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPatientStats() {
    try {
      const response = await api.get(`/patients/${id}/stats`);
      setPatientStats(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPatientDocs() {
    try {
      const res = await api.get(`/documents/patient/${id}`);
      setPatientDocs(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadAllDocs() {
    try {
      const res = await api.get("/documents");
      setAllDocs(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadBudgets() {
    try {
      const res = await api.get(`/budgets/patient/${id}`);
      setBudgets(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadTransactions() {
    try {
      const res = await api.get(`/financial?patientId=${id}`);
      setTransactions(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  function resetBudgetForm() {
    setBudgetForm({
      title: "",
      validUntil: "",
      discount: 0,
      observations: "",
      txPaymentMethod: "",
      txInstallments: "1",
      txDueDate: "",
      txNotes: "",
      items: [
        {
          procedureId: "",
          procedureName: "",
          quantity: 1,
          unitPrice: 0,
          observation: "",
        },
      ],
    });
  }

  function updateBudgetItem(index, patch) {
    setBudgetForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (
        i === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function handleBudgetProcedureSelect(index, procedureId) {
    const selected = procedures.find((item) => item.id === procedureId);
    updateBudgetItem(index, {
      procedureId,
      procedureName: selected?.name || "",
      unitPrice: selected?.price ?? 0,
      observation: selected?.description || "",
    });
  }

  function addBudgetItem() {
    setBudgetForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          procedureId: "",
          procedureName: "",
          quantity: 1,
          unitPrice: 0,
          observation: "",
        },
      ],
    }));
  }

  function removeBudgetItem(index) {
    setBudgetForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? current.items
        : current.items.filter((_, i) => i !== index),
    }));
  }

  async function createBudget() {
    if (savingBudget) return;
    const validItems = budgetForm.items.filter((item) => item.procedureName);
    if (!budgetForm.title.trim()) return toast.error("Informe o título do orçamento");
    if (validItems.length === 0) return toast.error("Adicione ao menos um procedimento");

    setSavingBudget(true);
    try {
      await api.post("/budgets", {
        patientId: id,
        title: budgetForm.title.trim(),
        validUntil: budgetForm.validUntil || null,
        discount: Number(budgetForm.discount) || 0,
        observations: budgetForm.observations,
        idempotencyKey: budgetKeyRef.current,
        txPaymentMethod: budgetForm.txPaymentMethod || null,
        txInstallments: Number(budgetForm.txInstallments) > 1 ? Number(budgetForm.txInstallments) : undefined,
        txDueDate: budgetForm.txDueDate || null,
        txNotes: budgetForm.txNotes || null,
        items: validItems.map((item) => ({
          procedureId: item.procedureId || null,
          procedureName: item.procedureName,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          observation: item.observation,
        })),
      });
      // Renova a chave para o próximo orçamento
      budgetKeyRef.current = crypto.randomUUID();
      toast.success("Orçamento criado");
      resetBudgetForm();
      setShowBudgetForm(false);
      loadBudgets();
    } catch (error) {
      toast.error(error?.response?.data?.error ?? "Erro ao criar orçamento");
    } finally {
      setSavingBudget(false);
    }
  }

  async function deleteBudget(budgetId) {
    if (!confirm("Excluir este orçamento?")) return;
    try {
      await api.delete(`/budgets/${budgetId}`);
      toast.success("Orçamento excluído");
      loadBudgets();
    } catch {
      toast.error("Erro ao excluir orçamento");
    }
  }

  async function sendDocToPatient(docId) {
    try {
      const res = await api.post("/documents/send", { patientId: id, documentId: docId });
      loadPatientDocs();
      openDocumentFlow(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Erro ao enviar documento");
    }
  }

  function openDocumentFlow(pd) {
    setSigningDoc(pd);
  }

  async function deletePatientDoc(pdId) {
    if (!confirm("Remover este documento do paciente?")) return;
    try {
      await api.delete(`/documents/patient-doc/${pdId}`);
      toast.success("Removido");
      loadPatientDocs();
    } catch {
      toast.error("Erro ao remover");
    }
  }

  function openFile(docId) {
    const token = localStorage.getItem("token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3000";
    window.open(`${base}/documents/${docId}/file?token=${token}`, "_blank");
  }

  function openSignedFile(patientDocId) {
    const token = localStorage.getItem("token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3000";
    window.open(`${base}/documents/patient-doc/${patientDocId}/file?token=${token}`, "_blank");
  }

  function handleProcedureSelect(procId) {
    setSelectedProcedureId(procId);
    const proc = procedures.find((p) => p.id === procId);
    if (!proc) {
      setProcedure("");
      setDescription("");
      setMaterials("");
      setMaterialsUsed([]);
      return;
    }
    setProcedure(proc.name);
    setDescription(proc.description || "");
    const items = (proc.products || []).map((pp) => ({
      name: pp.product?.name || pp.customName || "Material",
      quantity: pp.quantity ?? 1,
      unit: pp.product?.unit || "",
    }));
    setMaterialsUsed(items);
    setMaterials(
      items.map((m) => `${m.name}${m.quantity ? ` (${m.quantity}${m.unit ? " " + m.unit : ""})` : ""}`).join(", ")
    );
  }

  function resetEvolutionForm() {
    setSelectedProcedureId("");
    setProcedure("");
    setDescription("");
    setMaterials("");
    setMaterialsUsed([]);
  }

  async function createEvolution() {
    try {
      await api.post("/evolutions", {
        patientId: id,
        procedure,
        description,
        materials,
        procedureId: selectedProcedureId || undefined,
        materialsUsed: materialsUsed.length > 0 ? materialsUsed : undefined,
      });
      resetEvolutionForm();
      setShowEvolutionForm(false);
      loadEvolutions();
      toast.success("Evolução registrada");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar evolução");
    }
  }

  useEffect(() => {
    loadPatient();
    loadEvolutions();
    loadAppointments();
    loadProcedures();
    loadPatientStats();
    loadPatientDocs();
    loadAllDocs();
    loadBudgets();
    loadTransactions();
  }, []);

  useEffect(() => { loadSavedSummary(); }, []);

  if (!patient) {
    return (
      <MainLayout>
        <Spinner />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* VOLTAR */}
        <div className="mb-4">
          <button
            onClick={() =>
              navigate("/patients")
            }
            className="text-verde hover:opacity-70 transition"
          >
            ← Voltar
          </button>
        </div>

        {/* HEADER */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full bg-verde flex items-center justify-center shrink-0">
                <span className="text-white text-lg font-bold">
                  {patient.name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="font-serif font-light text-2xl md:text-[32px] text-verde-900 truncate">
                  {patient.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[12.5px] text-gray-500">
                  {patient.phone && <span className="font-mono">{patient.phone}</span>}
                  {patientStats?.birthday && <span>{patientStats.birthday.age} anos</span>}
                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="text-verde font-semibold hover:opacity-70 transition"
                  >
                    {showDetails ? "menos detalhes ↑" : "mais detalhes ↓"}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/patients/${id}/edit`)}
              className="border-[1.5px] border-creme-200 hover:border-verde/40 text-verde-900 px-4 py-2.5 rounded-xl font-bold text-sm transition shrink-0"
            >
              Editar
            </button>
          </div>

          {/* DETALHES EXPANDIDOS */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-creme-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-8 gap-y-3 text-sm text-gray-600">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">CPF</p>
                <p className="font-mono">{patient.cpf || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">RG</p>
                <p className="font-mono">{patient.rg || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Data de nascimento</p>
                <p className="font-mono">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString("pt-BR") : "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">CEP</p>
                <p className="font-mono">{patient.zipCode || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400 text-xs mb-0.5">Endereço</p>
                <p>{[patient.street, patient.city, patient.state].filter(Boolean).join(", ") || "—"}</p>
              </div>
              {patient.observations && (
                <div className="col-span-2 sm:col-span-3 md:col-span-4">
                  <p className="text-gray-400 text-xs mb-0.5">Observações</p>
                  <p className="leading-relaxed">{patient.observations}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ALERTA DO PACIENTE */}
        {patient.alertLevel && patient.alertLevel !== "none" && (() => {
          const level = getAlertLevel(patient.alertLevel);
          return (
            <div className={`flex items-start gap-3 rounded-2xl border p-4 mb-6 ${level.banner}`}>
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">{level.short}</p>
                <p className="text-sm mt-0.5 whitespace-pre-line">
                  {patient.observations?.trim() || "Este paciente possui um alerta ativo. Revise as observações clínicas."}
                </p>
              </div>
            </div>
          );
        })()}

      {/* RESUMO IA */}
      <div className="relative bg-gradient-to-br from-verde-900 to-verde-950 rounded-2xl p-5 mb-6 text-white">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-verde-200" />
            <span className="text-sm font-bold text-verde-200">Resumo IA</span>
          </div>
          <button
            onClick={generateSummary}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition text-xs font-semibold"
          >
            <Sparkles size={12} className={loadingSummary ? "animate-pulse" : ""} />
            {loadingSummary ? "Gerando…" : aiSummary ? "Atualizar" : "Gerar resumo"}
          </button>
        </div>
        {aiSummaryAt && !loadingSummary && (
          <p className="text-[11px] font-mono text-white/40 mb-2">
            Atualizado em {new Date(aiSummaryAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {loadingSummary && (
          <p className="text-sm text-white/50 animate-pulse">Analisando histórico do paciente…</p>
        )}
        {!loadingSummary && aiSummary && (
          <p className="text-sm text-white/75 leading-relaxed">{aiSummary}</p>
        )}
        {!loadingSummary && !aiSummary && (
          <p className="text-sm text-white/50">Clique em "Gerar resumo" para criar um resumo com IA do histórico deste paciente.</p>
        )}
      </div>

      {/* MENU */}
      <div className="border-b-[1.5px] border-creme-200 mb-6 flex gap-1 flex-wrap overflow-x-auto">
        <TabButton
          active={
            activeTab ===
            "dashboard"
          }
          onClick={() =>
            setActiveTab(
              "dashboard"
            )
          }
        >
          Dashboard
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "clinical"
          }
          onClick={() =>
            setActiveTab(
              "clinical"
            )
          }
        >
          Clínico
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "documents"
          }
          onClick={() =>
            setActiveTab(
              "documents"
            )
          }
        >
          Documentos
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "budgets"
          }
          onClick={() =>
            setActiveTab(
              "budgets"
            )
          }
        >
          Orçamentos
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "photos"
          }
          onClick={() =>
            setActiveTab(
              "photos"
            )
          }
        >
          Fotos
        </TabButton>

        <TabButton
          active={activeTab === "appointments"}
          onClick={() => setActiveTab("appointments")}
        >
          Agendamentos
        </TabButton>

        <TabButton
          active={activeTab === "timeline"}
          onClick={() => setActiveTab("timeline")}
        >
          Timeline
        </TabButton>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* ROW 1 — 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Aniversário */}
            <div className={`rounded-2xl p-5 border ${patientStats?.birthday?.isToday ? "bg-ambar border-ambar text-white" : "bg-creme-50 border-creme-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Cake size={15} className={patientStats?.birthday?.isToday ? "text-white/80" : "text-ambar"} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${patientStats?.birthday?.isToday ? "text-white/80" : "text-gray-400"}`}>Idade</span>
              </div>
              {patientStats?.birthday ? (
                <>
                  <p className={`text-2xl font-bold font-mono leading-none flex items-center gap-1.5 ${patientStats.birthday.isToday ? "text-white" : "text-verde"}`}>
                    {patientStats.birthday.age} anos{patientStats.birthday.isToday && <PartyPopper size={18} />}
                  </p>
                  <p className={`text-xs font-mono mt-1.5 ${patientStats.birthday.isToday ? "text-white/80" : "text-gray-400"}`}>
                    {new Date(patientStats.birthday.date).toLocaleDateString("pt-BR")}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-gray-300 leading-none">—</p>
              )}
            </div>

            {/* Cliente há */}
            <Card className="bg-creme-50! p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-[#6F7F73]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente há</span>
              </div>
              <p className="text-2xl font-bold font-mono text-verde leading-none">
                {patientStats?.clientSince?.label ?? "—"}
              </p>
              {patientStats?.clientSince && (
                <p className="text-xs font-mono text-gray-400 mt-1.5">
                  desde {new Date(patientStats.clientSince.date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </p>
              )}
            </Card>

            {/* Total agendamentos */}
            <Card className="bg-creme-50! p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={15} className="text-info" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Agendamentos</span>
              </div>
              <p className="text-2xl font-bold font-mono text-verde leading-none">
                {patientStats?.totalAppointments ?? "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">sessões realizadas</p>
            </Card>

            {/* Ticket médio */}
            <Card className="bg-creme-50! p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-sucesso" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ticket médio</span>
              </div>
              <p className="text-2xl font-bold font-mono text-verde leading-none">
                {patientStats?.avgTicket
                  ? patientStats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </p>
              {patientStats?.totalSpent > 0 && (
                <p className="text-xs font-mono text-gray-400 mt-1.5">
                  total {patientStats.totalSpent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
            </Card>
          </div>

          {/* ROW 2 — dias da semana + procedimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dias da semana */}
            <div className="bg-creme-50 border border-creme-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardList size={15} className="text-verde" />
                <span className="text-sm font-bold text-verde">Dias preferidos</span>
              </div>
              {patientStats?.weekdayDistribution ? (() => {
                const max = Math.max(...patientStats.weekdayDistribution.map((d) => d.count), 1);
                return (
                  <div className="flex items-end gap-1.5 h-24">
                    {patientStats.weekdayDistribution.map((d) => {
                      const pct = max > 0 ? (d.count / max) * 100 : 0;
                      const isTop = d.count > 0 && d.count === max;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                          <span className="text-[10px] font-mono font-semibold text-gray-400">{d.count || ""}</span>
                          <div className="w-full rounded-t-md transition-all" style={{
                            height: `${Math.max(pct, d.count > 0 ? 8 : 4)}%`,
                            backgroundColor: isTop ? "#00704A" : d.count > 0 ? "#6F7F73" : "#EFE7DA",
                            minHeight: "4px",
                          }} />
                          <span className="text-[10px] text-gray-400 font-medium">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
                <p className="text-sm text-gray-400 text-center py-6">Sem dados ainda</p>
              )}
            </div>

            {/* Top procedimentos */}
            <div className="bg-creme-50 border border-creme-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList size={15} className="text-verde" />
                <span className="text-sm font-bold text-verde">Procedimentos frequentes</span>
              </div>
              {patientStats?.topProcedures?.length > 0 ? (() => {
                const max = patientStats.topProcedures[0].count;
                return (
                  <div className="space-y-3">
                    {patientStats.topProcedures.map((p, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="font-serif italic text-ambar-500 text-[15px] w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-verde truncate max-w-[70%]">{p.name}</span>
                          <span className="text-xs font-mono text-gray-400 shrink-0">{p.count}x</span>
                        </div>
                        <div className="h-1.5 bg-creme-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(p.count / max) * 100}%`,
                              backgroundColor: i === 0 ? "#00704A" : "#6F7F73",
                            }}
                          />
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : (
                <p className="text-sm text-gray-400 text-center py-6">Sem dados ainda</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLÍNICO TAB */}
      {activeTab === "clinical" && (
        <div className="mb-8">

          {/* SUBMENU */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {[["evolucao", "Evolução"], ["mapa", "Mapa de Aplicação"], ["anamnese", "Anamnese"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setClinicalSubTab(key)}
                className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition border-[1.5px] ${
                  clinicalSubTab === key
                    ? "bg-verde-50 text-verde-900 border-verde-300"
                    : "bg-creme-50 text-gray-500 border-creme-200 hover:border-ambar/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* SUBABA: EVOLUÇÃO */}
          {clinicalSubTab === "evolucao" && (
          <Card className="bg-creme-50! rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-verde">Evoluções</h2>
              <button
                onClick={() => setShowEvolutionForm(!showEvolutionForm)}
                className="bg-verde hover:bg-verde-900 text-white px-4 py-2 rounded-lg transition text-sm"
              >
                Nova evolução
              </button>
            </div>

          {/* FORM */}
          {showEvolutionForm && (
            <div className="bg-white border border-creme-200 rounded-xl p-5 mb-6 space-y-4">
              {/* Procedimento */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                <select
                  value={selectedProcedureId}
                  onChange={(e) => handleProcedureSelect(e.target.value)}
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                >
                  <option value="">Selecione o procedimento</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.duration ? ` (${p.duration} min)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descrição */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Descrição clínica</label>
                  <div className="flex items-center gap-2">
                    {selectedProcedureId && procedures.find((p) => p.id === selectedProcedureId)?.description && (
                      <span className="text-xs text-verde bg-creme-100 px-2 py-0.5 rounded-full">
                        Pré-preenchido
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!procedure || loadingDraft}
                      onClick={generateEvolutionDraft}
                      className="flex items-center gap-1 text-xs text-verde hover:opacity-70 disabled:opacity-30 transition"
                    >
                      <Sparkles size={11} className={loadingDraft ? "animate-pulse" : ""} />
                      {loadingDraft ? "Gerando…" : "Gerar com IA"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição clínica da sessão…"
                  rows={4}
                  className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>

              {/* Materiais */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Materiais utilizados</label>
                  {materialsUsed.length > 0 && (
                    <span className="text-xs text-verde bg-creme-100 px-2 py-0.5 rounded-full">
                      {materialsUsed.length} {materialsUsed.length === 1 ? "item" : "itens"} do procedimento
                    </span>
                  )}
                </div>
                <input
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Ex: Botox 50U, Hyalurônico 1ml…"
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { resetEvolutionForm(); setShowEvolutionForm(false); }}
                  className="border border-ambar px-4 py-2 rounded-xl text-sm hover:bg-creme-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={createEvolution}
                  disabled={!procedure}
                  className="bg-verde hover:bg-verde-900 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                >
                  Salvar evolução
                </button>
              </div>
            </div>
          )}

          {/* LISTA DE EVOLUÇÕES */}
          <div className="space-y-4">
            {evolutions.length === 0 && (
              <p className="text-gray-500">Nenhuma evolução cadastrada.</p>
            )}
            {evolutions.map((evolution) => (
              <div key={evolution.id} className="bg-white border border-creme-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-verde">{evolution.procedure}</h3>
                  <span className="text-sm font-mono text-gray-500">
                    {new Date(evolution.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="text-gray-700">{evolution.description}</p>
                {evolution.materials && (
                  <p className="text-sm text-gray-500 mt-2">Materiais: {evolution.materials}</p>
                )}
              </div>
            ))}
          </div>
          </Card>
          )}

          {/* SUBABA: MAPA */}
          {clinicalSubTab === "mapa" && (
            <ProcedureMapTab patientId={id} procedures={procedures} />
          )}

          {clinicalSubTab === "anamnese" && (
            <AnamnesisTab patientId={id} />
          )}

        </div>
      )}

      {/* AGENDAMENTOS */}
      {activeTab === "appointments" && (
        <Card className="bg-creme-50! rounded-2xl overflow-hidden p-0">
          <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-verde">Agendamentos</span>
            <span className="text-xs text-gray-500">{appointments.length} registro{appointments.length !== 1 ? "s" : ""}</span>
          </div>
          {appointments.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">Nenhum agendamento registrado.</p>
          ) : (
            <div className="divide-y divide-creme-200">
              {[...appointments].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt)).map((appt) => (
                <div key={appt.id} className="flex items-center justify-between px-5 py-3.5 bg-white hover:bg-creme-50 transition">
                  <div>
                    <p className="text-sm font-semibold text-verde">{appt.procedureType || appt.title || "Agendamento"}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                      {new Date(appt.startsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      {" · "}
                      {new Date(appt.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {appt.professional ? ` · ${appt.professional}` : ""}
                    </p>
                    {appt.notes && <p className="text-xs text-gray-400 mt-0.5">{appt.notes}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-4 ${
                    appt.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    appt.status === "CANCELED"  ? "bg-red-100 text-red-600" :
                    appt.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {appt.status === "COMPLETED" ? "Realizado" :
                     appt.status === "CANCELED"  ? "Cancelado" :
                     appt.status === "CONFIRMED" ? "Confirmado" : "Agendado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* DOCUMENTOS */}
      {activeTab === "documents" && (() => {
        const signed  = patientDocs.filter((d) => d.status === "signed");
        const pending = patientDocs.filter((d) => d.status === "pending");
        const linkedDocIds = new Set(patientDocs.map((d) => d.documentId));
        const available = allDocs.filter((d) => !linkedDocIds.has(d.id));

        const TYPE_COLORS = {
          contrato: "bg-blue-100 text-blue-700",
          termo:    "bg-amber-100 text-amber-700",
          anamnese: "bg-purple-100 text-purple-700",
          laudo:    "bg-green-100 text-green-700",
          outro:    "bg-gray-100 text-gray-500",
        };

        return (
          <div className="space-y-5">
            {/* Documentos Assinados */}
            {signed.length > 0 && (
              <Card className="bg-creme-50! rounded-2xl overflow-hidden p-0">
                <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200">
                  <span className="text-sm font-semibold text-verde">Documentos Assinados</span>
                </div>
                <div className="divide-y divide-creme-200">
                  {signed.map((pd) => (
                    <div key={pd.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F3EEE5] transition group">
                      <FileText size={16} className="text-verde shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-verde truncate">{pd.document.name}</p>
                        <p className="text-xs font-mono text-gray-400">
                          {pd.signedAt ? new Date(pd.signedAt).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[pd.document.type] ?? TYPE_COLORS.outro}`}>
                        {pd.document.type}
                      </span>
                      {pd.signedHash ? (
                        <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Check size={11} /> Com auditoria
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          Finalizar hash
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => pd.signedFilePath ? openSignedFile(pd.id) : setSigningDoc(pd)} title="Abrir PDF assinado" className="w-7 h-7 flex items-center justify-center border border-ambar rounded-lg hover:bg-white transition">
                          <Eye size={13} className="text-verde" />
                        </button>
                        <button onClick={() => openFile(pd.document.id)} title="Abrir PDF original" className="w-7 h-7 flex items-center justify-center border border-ambar rounded-lg hover:bg-white transition">
                          <Download size={13} className="text-verde" />
                        </button>
                        <button onClick={() => deletePatientDoc(pd.id)} title="Remover" className="w-7 h-7 flex items-center justify-center border border-red-200 rounded-lg hover:bg-red-50 transition">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Aguardando assinatura */}
            {pending.length > 0 && (
              <Card className="bg-creme-50! rounded-2xl overflow-hidden p-0">
                <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-verde">Aguardando Assinatura</span>
                </div>
                <div className="divide-y divide-creme-200">
                  {pending.map((pd) => (
                    <div key={pd.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F3EEE5] transition group">
                      <FileText size={16} className="text-ambar shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-verde truncate">{pd.document.name}</p>
                        <p className="text-xs font-mono text-gray-400">{new Date(pd.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[pd.document.type] ?? TYPE_COLORS.outro}`}>
                        {pd.document.type}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openDocumentFlow(pd)}
                          className="flex items-center gap-1.5 bg-verde hover:bg-verde-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l4-4 4 4 8-8"/></svg>
                          Assinar
                        </button>
                        <button onClick={() => deletePatientDoc(pd.id)} className="w-7 h-7 flex items-center justify-center border border-red-200 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Disponíveis para enviar */}
            <Card className="bg-creme-50! rounded-2xl overflow-hidden p-0">
              <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-verde">Documentos Disponíveis para Assinar</span>
              </div>
              {available.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {allDocs.length === 0
                    ? "Nenhum documento cadastrado na Pasta Sanitária."
                    : "Todos os documentos já foram enviados."}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                  {available.map((doc) => (
                    <div key={doc.id} className="bg-white border border-creme-200 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-2.5">
                        <FileText size={16} className="text-verde mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-verde truncate">{doc.name}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${TYPE_COLORS[doc.type] ?? TYPE_COLORS.outro}`}>
                            {doc.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openFile(doc.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-ambar hover:bg-creme-100 py-1.5 rounded-lg text-xs text-verde font-medium transition"
                        >
                          <Eye size={12} /> Visualizar
                        </button>
                        <button
                          onClick={() => sendDocToPatient(doc.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-verde hover:bg-verde-900 text-white py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <Send size={12} /> Assinar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })()}


      {signingDoc && (
        <SigningModal
          patientDoc={signingDoc}
          patient={patient}
          onClose={() => setSigningDoc(null)}
          onSigned={loadPatientDocs}
        />
      )}

      {/* ORÇAMENTOS */}
      {activeTab ===
        "budgets" && (
        <div className="bg-creme-50 border border-creme-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-verde">Orçamentos</h2>
            <button
              onClick={() => {
                if (!showBudgetForm) budgetKeyRef.current = crypto.randomUUID();
                setShowBudgetForm(!showBudgetForm);
              }}
              className="bg-verde hover:bg-verde-900 text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
            >
              <Plus size={15} />
              Novo orçamento
            </button>
          </div>

          {showBudgetForm && (() => {
            const subtotal = budgetForm.items.reduce((sum, item) => (
              sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))
            ), 0);
            const discount = Number(budgetForm.discount) || 0;
            const total = Math.max(subtotal - discount, 0);

            return (
              <div className="bg-white border border-creme-200 rounded-xl p-5 mb-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Título do orçamento *</label>
                    <input
                      value={budgetForm.title}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, title: e.target.value }))}
                      placeholder="Ex: Pacote Harmonização Facial"
                      className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Válido até</label>
                    <input
                      type="date"
                      value={budgetForm.validUntil}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, validUntil: e.target.value }))}
                      className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-verde">Itens do orçamento</h3>
                    <button
                      onClick={addBudgetItem}
                      className="border border-ambar hover:bg-creme-100 text-verde px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      Adicionar item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {budgetForm.items.map((item, index) => {
                      const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

                      return (
                        <div key={index} className="border border-creme-200 rounded-xl p-4 bg-creme-50 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.65fr_0.8fr_0.8fr_auto] gap-3 items-end">
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                              <select
                                value={item.procedureId}
                                onChange={(e) => handleBudgetProcedureSelect(index, e.target.value)}
                                className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                              >
                                <option value="">Buscar procedimento...</option>
                                {procedures.map((proc) => (
                                  <option key={proc.id} value={proc.id}>
                                    {proc.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Qtd</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateBudgetItem(index, { quantity: e.target.value })}
                                className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Preço un.</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => updateBudgetItem(index, { unitPrice: e.target.value })}
                                className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Total</label>
                              <div className="w-full border border-creme-200 bg-white rounded-xl p-3 text-sm font-mono text-gray-500">
                                {itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                            </div>
                            <button
                              onClick={() => removeBudgetItem(index)}
                              className="h-11 px-4 border border-red-200 rounded-xl hover:bg-red-50 text-red-400 transition flex items-center justify-center"
                              title="Remover item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-500 block mb-1.5">Observação do item</label>
                            <input
                              value={item.observation}
                              onChange={(e) => updateBudgetItem(index, { observation: e.target.value })}
                              placeholder="Ex: Sessão única, retorno gratuito..."
                              className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-verde">Subtotal</span>
                    <strong className="font-mono text-verde">
                      {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-center">
                    <label className="text-sm text-verde">Desconto (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetForm.discount}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, discount: e.target.value }))}
                      className="border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-rose-100 pt-3">
                    <span className="text-base font-bold text-verde">Total</span>
                    <strong className="text-lg font-mono text-pink-600">
                      {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Observações</label>
                  <textarea
                    value={budgetForm.observations}
                    onChange={(e) => setBudgetForm((current) => ({ ...current, observations: e.target.value }))}
                    placeholder="Condições de pagamento, informações adicionais..."
                    rows={3}
                    className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-verde/20"
                  />
                </div>

                {/* informações financeiras */}
                {(() => {
                  const txTotal = Math.max(subtotal - (Number(budgetForm.discount) || 0), 0);
                  const txN = Number(budgetForm.txInstallments) || 1;
                  const set = (k) => (e) => setBudgetForm((c) => ({ ...c, [k]: e.target.value }));
                  return (
                    <div className="border border-creme-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Financeiro</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1.5">Forma de pagamento</label>
                          <select
                            value={budgetForm.txPaymentMethod}
                            onChange={set("txPaymentMethod")}
                            className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                          >
                            <option value="">Selecione</option>
                            {["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1.5">Parcelas</label>
                          <input
                            type="number" min="1" max="60"
                            value={budgetForm.txInstallments}
                            onChange={set("txInstallments")}
                            className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1.5">
                          {txN > 1 ? "Vencimento 1ª parcela" : "Vencimento"}
                        </label>
                        <input
                          type="date"
                          value={budgetForm.txDueDate}
                          onChange={set("txDueDate")}
                          className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                        />
                      </div>

                      {txN > 1 && txTotal > 0 && (
                        <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                          <span className="font-mono">
                            {txN}x de{" "}
                            {(txTotal / txN).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                          {" "}— vencimento mensal a partir da data informada
                        </p>
                      )}

                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1.5">Observação financeira</label>
                        <input
                          value={budgetForm.txNotes}
                          onChange={set("txNotes")}
                          placeholder="Ex: entrada + 3x, pagar na consulta…"
                          className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { resetBudgetForm(); setShowBudgetForm(false); }}
                    className="border border-ambar px-4 py-2 rounded-xl text-sm hover:bg-creme-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createBudget}
                    disabled={savingBudget}
                    className="bg-verde hover:bg-verde-900 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                  >
                    {savingBudget ? "Criando…" : "Criar orçamento"}
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="space-y-4">
            {budgets.length === 0 ? (
              <p className="text-gray-500">Nenhum orçamento cadastrado.</p>
            ) : (
              budgets.map((budget) => (
                <div key={budget.id} className="bg-white border border-creme-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-verde">{budget.title}</h3>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">
                        Criado em {new Date(budget.createdAt).toLocaleDateString("pt-BR")}
                        {budget.validUntil ? ` · válido até ${new Date(budget.validUntil).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold font-mono text-verde">
                        {budget.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <button
                        onClick={() => deleteBudget(budget.id)}
                        className="w-8 h-8 border border-red-200 rounded-lg hover:bg-red-50 text-red-400 transition flex items-center justify-center"
                        title="Excluir orçamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-creme-100 border border-creme-100 rounded-xl overflow-hidden">
                    {budget.items.map((item) => (
                      <div key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-verde truncate">{item.procedureName}</p>
                          {item.observation && (
                            <p className="text-xs text-gray-400 truncate">{item.observation}</p>
                          )}
                        </div>
                        <span className="text-xs font-mono text-gray-500 shrink-0">
                          {item.quantity} x {item.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {budget.observations && (
                    <p className="text-sm text-gray-500 mt-3">{budget.observations}</p>
                  )}

                  {/* transações vinculadas */}
                  {budget.transactions?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-creme-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Transações</p>
                      <div className="space-y-1.5">
                        {budget.transactions.map((tx) => {
                          const pillColor = tx.status === "confirmado"
                            ? "bg-emerald-100 text-emerald-700"
                            : tx.status === "pendente"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500";
                          return (
                            <div key={tx.id} className="flex items-center justify-between bg-creme-50 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                {tx.type === "receita"
                                  ? <TrendingUp size={12} className="text-emerald-600 shrink-0" />
                                  : <TrendingDown size={12} className="text-red-500 shrink-0" />}
                                <div>
                                  <p className="text-xs font-medium text-verde truncate max-w-[180px]">{tx.description}</p>
                                  {tx.paymentMethod && <p className="text-[10px] text-gray-400">{tx.paymentMethod}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold font-mono text-verde">
                                  {Number(tx.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillColor}`}>
                                  {tx.status === "confirmado" ? "Pago" : tx.status === "pendente" ? "Pendente" : "Cancelado"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FOTOS */}
      {activeTab === "photos" && (
        <PatientPhotos patientId={id} />
      )}

      {/* TIMELINE */}
      {activeTab === "timeline" && (() => {
        const TYPE_CONFIG = {
          cadastro:    { label: "Cadastro",     dot: "bg-verde",  badge: "bg-creme-100 text-verde" },
          evolution:   { label: "Evolução",     dot: "bg-emerald-500", badge: "bg-green-100 text-green-700" },
          appointment: { label: "Agendamento",  dot: "bg-blue-400",   badge: "bg-blue-100 text-blue-700" },
          transaction: { label: "Financeiro",   dot: "bg-amber-400",  badge: "bg-amber-100 text-amber-700" },
          budget:      { label: "Orçamento",    dot: "bg-purple-400", badge: "bg-purple-100 text-purple-700" },
          document:    { label: "Documento",    dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600" },
        };

        const items = [
          // Cadastro do paciente
          { type: "cadastro", date: new Date(patient.createdAt),
            label: "Paciente cadastrado",
            detail: patient.email || null,
          },
          // Edição de cadastro (updatedAt se diferente de createdAt)
          ...(patient.updatedAt && patient.updatedAt !== patient.createdAt ? [{
            type: "cadastro", date: new Date(patient.updatedAt),
            label: "Cadastro atualizado", detail: null,
          }] : []),
          // Evoluções
          ...evolutions.map((e) => ({
            type: "evolution", date: new Date(e.createdAt),
            label: e.procedure || "Evolução clínica",
            detail: e.description,
            sub: e.materials ? `Materiais: ${e.materials}` : null,
          })),
          // Agendamentos
          ...appointments.map((a) => ({
            type: "appointment", date: new Date(a.startsAt),
            label: a.procedureType || a.title || "Agendamento",
            detail: a.professional || null,
            sub: a.notes || null,
            badge: a.status === "COMPLETED" ? "Realizado" :
                   a.status === "CANCELED"  ? "Cancelado" :
                   a.status === "CONFIRMED" ? "Confirmado" : "Agendado",
          })),
          // Transações financeiras
          ...transactions.map((t) => ({
            type: "transaction", date: new Date(t.createdAt),
            label: t.description || (t.type === "receita" ? "Receita" : "Despesa"),
            detail: `R$ ${Number(t.amount).toFixed(2).replace(".", ",")} · ${t.status}`,
            sub: t.paymentMethod || null,
          })),
          // Orçamentos
          ...budgets.map((b) => ({
            type: "budget", date: new Date(b.createdAt),
            label: b.title || "Orçamento",
            detail: `Total: R$ ${Number(b.total).toFixed(2).replace(".", ",")}`,
            sub: b.validUntil ? `Válido até ${new Date(b.validUntil).toLocaleDateString("pt-BR")}` : null,
          })),
          // Documentos vinculados
          ...patientDocs.map((d) => ({
            type: "document", date: new Date(d.createdAt),
            label: d.document?.title || "Documento",
            detail: d.status === "signed" ? "Assinado" : "Pendente de assinatura",
          })),
        ].sort((a, b) => b.date - a.date);

        return (
          <div className="bg-creme-50 border border-creme-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-verde">Timeline</h2>
              <span className="text-xs text-gray-400">{items.length} evento{items.length !== 1 ? "s" : ""}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-gray-500">Nenhum evento registrado.</p>
            ) : (
              <div className="relative border-l-2 border-creme-200 pl-6 space-y-5">
                {items.map((item, i) => {
                  const cfg = TYPE_CONFIG[item.type];
                  return (
                    <div key={i} className="relative">
                      <span className={`absolute -left-[25px] w-3.5 h-3.5 rounded-full border-2 border-white ${cfg.dot}`} />
                      <div className="bg-white border border-creme-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {item.badge ?? cfg.label}
                          </span>
                          <span className="text-xs font-mono text-gray-400">
                            {item.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {" "}
                            {item.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="font-semibold text-verde mt-1 text-sm">{item.label}</p>
                        {item.detail && <p className="text-sm text-gray-500 mt-0.5">{item.detail}</p>}
                        {item.sub    && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}


    </MainLayout>
  );
}
function TabButton({
  children,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-[13.5px] whitespace-nowrap transition border-b-2 ${
        active
          ? "border-verde text-verde-900 font-bold"
          : "border-transparent text-gray-500 font-medium hover:text-verde"
      }`}
    >
      {children}
    </button>
  );
}
