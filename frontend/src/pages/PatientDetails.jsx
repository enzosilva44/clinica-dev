import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles, Cake, CalendarDays, ClipboardList, TrendingUp, Users, FileText, Download, Trash2, Eye, Send, Plus } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";
import ProcedureMapTab from "../components/procedure-map/ProcedureMapTab";
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

  const [activeTab, setActiveTab] =
    useState("dashboard");

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
  const [patientDocs, setPatientDocs] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [signingDoc, setSigningDoc] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState(() => ({
    title: "",
    validUntil: "",
    discount: 0,
    observations: "",
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

  async function generateSummary() {
    setLoadingSummary(true);
    setAiSummary("");
    try {
      const res = await api.post(`/ai/patient-summary/${id}`);
      setAiSummary(res.data.summary);
    } catch (error) {
      toast.error("Erro ao gerar resumo");
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

  function resetBudgetForm() {
    setBudgetForm({
      title: "",
      validUntil: "",
      discount: 0,
      observations: "",
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
    const validItems = budgetForm.items.filter((item) => item.procedureName);
    if (!budgetForm.title.trim()) return toast.error("Informe o título do orçamento");
    if (validItems.length === 0) return toast.error("Adicione ao menos um procedimento");

    try {
      await api.post("/budgets", {
        patientId: id,
        title: budgetForm.title.trim(),
        validUntil: budgetForm.validUntil || null,
        discount: Number(budgetForm.discount) || 0,
        observations: budgetForm.observations,
        items: validItems.map((item) => ({
          procedureId: item.procedureId || null,
          procedureName: item.procedureName,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          observation: item.observation,
        })),
      });
      toast.success("Orçamento criado");
      resetBudgetForm();
      setShowBudgetForm(false);
      loadBudgets();
    } catch (error) {
      toast.error(error?.response?.data?.error ?? "Erro ao criar orçamento");
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
      setSigningDoc(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Erro ao enviar documento");
    }
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
  }, []);

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
            className="text-[#314D3E] hover:opacity-70 transition"
          >
            ← Voltar
          </button>
        </div>
          
        {/* HEADER */}
        <div className="bg-[#314D3E] rounded-2xl p-5 md:p-6 mb-6 text-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold truncate">
                {patient.name}
              </h1>
              <div className="flex flex-wrap gap-4 md:gap-8 mt-3 text-sm text-white/90">
                <div>
                  <p className="text-white/60">Telefone</p>
                  <p>{patient.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-white/60">Email</p>
                  <p className="truncate max-w-48">{patient.email || "-"}</p>
                </div>
                <div>
                  <p className="text-white/60">Cidade</p>
                  <p>{patient.city || "-"}</p>
                </div>
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
              <button className="text-sm text-white/70 hover:text-white transition">
                Mais detalhes
              </button>
              <button className="bg-[#D8C3A5] text-[#314D3E] px-4 py-2 rounded-lg font-medium text-sm">
                Editar dados
              </button>
            </div>
          </div>
        </div>

      {/* DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card
          title="Total sessões"
          value={evolutions.length}
        />

        <Card
          title="Última consulta"
          value={
            evolutions[0]
              ? new Date(
                  evolutions[0].createdAt
                ).toLocaleDateString(
                  "pt-BR"
                )
              : "-"
          }
        />

        <Card
          title="Cidade"
          value={patient.city}
        />

        <Card
          title="Telefone"
          value={patient.phone}
        />
      </div>

      {/* MENU */}
      <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-2 mb-6 flex gap-2 flex-wrap">
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

        <TabButton
          active={activeTab === "sessions"}
          onClick={() => setActiveTab("sessions")}
        >
          Sessões
        </TabButton>

        <TabButton
          active={activeTab === "mapa"}
          onClick={() => setActiveTab("mapa")}
        >
          Mapa
        </TabButton>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* ROW 1 — 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Aniversário */}
            <div className={`rounded-2xl p-5 border ${patientStats?.birthday?.isToday ? "bg-[#C4895A] border-[#C4895A] text-white" : "bg-[#FAF7F2] border-[#E5D8C5]"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Cake size={15} className={patientStats?.birthday?.isToday ? "text-white/80" : "text-[#C4895A]"} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${patientStats?.birthday?.isToday ? "text-white/80" : "text-gray-400"}`}>Idade</span>
              </div>
              {patientStats?.birthday ? (
                <>
                  <p className={`text-2xl font-bold leading-none ${patientStats.birthday.isToday ? "text-white" : "text-[#314D3E]"}`}>
                    {patientStats.birthday.age} anos{patientStats.birthday.isToday ? " 🎉" : ""}
                  </p>
                  <p className={`text-xs mt-1.5 ${patientStats.birthday.isToday ? "text-white/80" : "text-gray-400"}`}>
                    {new Date(patientStats.birthday.date).toLocaleDateString("pt-BR")}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-gray-300 leading-none">—</p>
              )}
            </div>

            {/* Cliente há */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-[#7C9A92]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente há</span>
              </div>
              <p className="text-2xl font-bold text-[#314D3E] leading-none">
                {patientStats?.clientSince?.label ?? "—"}
              </p>
              {patientStats?.clientSince && (
                <p className="text-xs text-gray-400 mt-1.5">
                  desde {new Date(patientStats.clientSince.date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </p>
              )}
            </div>

            {/* Total agendamentos */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={15} className="text-[#4A8EC2]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Agendamentos</span>
              </div>
              <p className="text-2xl font-bold text-[#314D3E] leading-none">
                {patientStats?.totalAppointments ?? "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1.5">sessões realizadas</p>
            </div>

            {/* Ticket médio */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-[#3A9B6F]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ticket médio</span>
              </div>
              <p className="text-2xl font-bold text-[#314D3E] leading-none">
                {patientStats?.avgTicket
                  ? patientStats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </p>
              {patientStats?.totalSpent > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  total {patientStats.totalSpent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
            </div>
          </div>

          {/* ROW 2 — dias da semana + procedimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dias da semana */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardList size={15} className="text-[#314D3E]" />
                <span className="text-sm font-bold text-[#314D3E]">Dias preferidos</span>
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
                          <span className="text-[10px] font-semibold text-gray-400">{d.count || ""}</span>
                          <div className="w-full rounded-t-md transition-all" style={{
                            height: `${Math.max(pct, d.count > 0 ? 8 : 4)}%`,
                            backgroundColor: isTop ? "#314D3E" : d.count > 0 ? "#7C9A92" : "#EFE7DA",
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
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList size={15} className="text-[#314D3E]" />
                <span className="text-sm font-bold text-[#314D3E]">Procedimentos frequentes</span>
              </div>
              {patientStats?.topProcedures?.length > 0 ? (() => {
                const max = patientStats.topProcedures[0].count;
                return (
                  <div className="space-y-3">
                    {patientStats.topProcedures.map((p, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[#314D3E] truncate max-w-[70%]">{p.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{p.count}x</span>
                        </div>
                        <div className="h-1.5 bg-[#EFE7DA] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(p.count / max) * 100}%`,
                              backgroundColor: i === 0 ? "#314D3E" : "#7C9A92",
                            }}
                          />
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
      {activeTab ===
        "clinical" && (
        <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#314D3E]">
              Evoluções
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={generateSummary}
                disabled={loadingSummary}
                className="flex items-center gap-1.5 border border-[#D6C1A3] hover:bg-[#EFE7DA] disabled:opacity-50 text-[#314D3E] px-3 py-2 rounded-lg transition text-sm"
              >
                <Sparkles size={14} className={loadingSummary ? "animate-pulse" : ""} />
                {loadingSummary ? "Gerando…" : "Resumo IA"}
              </button>
              <button
                onClick={() => setShowEvolutionForm(!showEvolutionForm)}
                className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2 rounded-lg transition text-sm"
              >
                Nova evolução
              </button>
            </div>
          </div>

          {/* AI SUMMARY */}
          {aiSummary && (
            <div className="bg-white border border-[#314D3E]/20 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} className="text-[#314D3E]" />
                <span className="text-xs font-semibold text-[#314D3E] uppercase tracking-wide">Resumo gerado por IA</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
              <button
                onClick={() => setAiSummary("")}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2 transition"
              >
                Fechar
              </button>
            </div>
          )}

          {/* FORM */}
          {showEvolutionForm && (
            <div className="bg-white border border-[#E5D8C5] rounded-xl p-5 mb-6 space-y-4">
              {/* Procedimento */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                <select
                  value={selectedProcedureId}
                  onChange={(e) => handleProcedureSelect(e.target.value)}
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
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
                      <span className="text-xs text-[#314D3E] bg-[#EFE7DA] px-2 py-0.5 rounded-full">
                        Pré-preenchido
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!procedure || loadingDraft}
                      onClick={generateEvolutionDraft}
                      className="flex items-center gap-1 text-xs text-[#314D3E] hover:opacity-70 disabled:opacity-30 transition"
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
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                />
              </div>

              {/* Materiais */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Materiais utilizados</label>
                  {materialsUsed.length > 0 && (
                    <span className="text-xs text-[#314D3E] bg-[#EFE7DA] px-2 py-0.5 rounded-full">
                      {materialsUsed.length} {materialsUsed.length === 1 ? "item" : "itens"} do procedimento
                    </span>
                  )}
                </div>
                <input
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Ex: Botox 50U, Hyalurônico 1ml…"
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { resetEvolutionForm(); setShowEvolutionForm(false); }}
                  className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm hover:bg-[#EFE7DA] transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={createEvolution}
                  disabled={!procedure}
                  className="bg-[#314D3E] hover:bg-[#465634] disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                >
                  Salvar evolução
                </button>
              </div>
            </div>
          )}

          {/* TIMELINE */}
          <div className="space-y-4">
            {evolutions.length ===
              0 && (
              <p className="text-gray-500">
                Nenhuma evolução
                cadastrada.
              </p>
            )}

            {evolutions.map(
              (evolution) => (
                <div
                  key={
                    evolution.id
                  }
                  className="bg-white border border-[#E5D8C5] rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-[#314D3E]">
                      {
                        evolution.procedure
                      }
                    </h3>

                    <span className="text-sm text-gray-500">
                      {new Date(
                        evolution.createdAt
                      ).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  </div>

                  <p className="text-gray-700">
                    {
                      evolution.description
                    }
                  </p>

                  {evolution.materials && (
                    <p className="text-sm text-gray-500 mt-2">
                      Materiais:{" "}
                      {
                        evolution.materials
                      }
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* AGENDAMENTOS */}
      {activeTab ===
        "appointments" && (
        <Placeholder title="Agendamentos" />
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
              <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-[#EFE7DA] border-b border-[#E5D8C5]">
                  <span className="text-sm font-semibold text-[#314D3E]">Documentos Assinados</span>
                </div>
                <div className="divide-y divide-[#E5D8C5]">
                  {signed.map((pd) => (
                    <div key={pd.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F3EEE5] transition group">
                      <FileText size={16} className="text-[#314D3E] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#314D3E] truncate">{pd.document.name}</p>
                        <p className="text-xs text-gray-400">
                          {pd.signedAt ? new Date(pd.signedAt).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[pd.document.type] ?? TYPE_COLORS.outro}`}>
                        {pd.document.type}
                      </span>
                      {pd.signedHash ? (
                        <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          ✓ Com auditoria
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          Finalizar hash
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => pd.signedFilePath ? openSignedFile(pd.id) : setSigningDoc(pd)} title="Abrir PDF assinado" className="w-7 h-7 flex items-center justify-center border border-[#D6C1A3] rounded-lg hover:bg-white transition">
                          <Eye size={13} className="text-[#314D3E]" />
                        </button>
                        <button onClick={() => openFile(pd.document.id)} title="Abrir PDF original" className="w-7 h-7 flex items-center justify-center border border-[#D6C1A3] rounded-lg hover:bg-white transition">
                          <Download size={13} className="text-[#314D3E]" />
                        </button>
                        <button onClick={() => deletePatientDoc(pd.id)} title="Remover" className="w-7 h-7 flex items-center justify-center border border-red-200 rounded-lg hover:bg-red-50 transition">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aguardando assinatura */}
            {pending.length > 0 && (
              <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-[#EFE7DA] border-b border-[#E5D8C5] flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#314D3E]">Aguardando Assinatura</span>
                </div>
                <div className="divide-y divide-[#E5D8C5]">
                  {pending.map((pd) => (
                    <div key={pd.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F3EEE5] transition group">
                      <FileText size={16} className="text-[#C4895A] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#314D3E] truncate">{pd.document.name}</p>
                        <p className="text-xs text-gray-400">{new Date(pd.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[pd.document.type] ?? TYPE_COLORS.outro}`}>
                        {pd.document.type}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setSigningDoc(pd)}
                          className="flex items-center gap-1.5 bg-[#314D3E] hover:bg-[#465634] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
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
              </div>
            )}

            {/* Disponíveis para enviar */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 bg-[#EFE7DA] border-b border-[#E5D8C5] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#314D3E]">Documentos Disponíveis para Assinar</span>
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
                    <div key={doc.id} className="bg-white border border-[#E5D8C5] rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-2.5">
                        <FileText size={16} className="text-[#314D3E] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#314D3E] truncate">{doc.name}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${TYPE_COLORS[doc.type] ?? TYPE_COLORS.outro}`}>
                            {doc.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openFile(doc.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-[#D6C1A3] hover:bg-[#EFE7DA] py-1.5 rounded-lg text-xs text-[#314D3E] font-medium transition"
                        >
                          <Eye size={12} /> Visualizar
                        </button>
                        <button
                          onClick={() => sendDocToPatient(doc.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#314D3E] hover:bg-[#465634] text-white py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          <Send size={12} /> Assinar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#314D3E]">Orçamentos</h2>
            <button
              onClick={() => setShowBudgetForm(!showBudgetForm)}
              className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
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
              <div className="bg-white border border-[#E5D8C5] rounded-xl p-5 mb-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Título do orçamento *</label>
                    <input
                      value={budgetForm.title}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, title: e.target.value }))}
                      placeholder="Ex: Pacote Harmonização Facial"
                      className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Válido até</label>
                    <input
                      type="date"
                      value={budgetForm.validUntil}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, validUntil: e.target.value }))}
                      className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#314D3E]">Itens do orçamento</h3>
                    <button
                      onClick={addBudgetItem}
                      className="border border-[#D6C1A3] hover:bg-[#EFE7DA] text-[#314D3E] px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      Adicionar item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {budgetForm.items.map((item, index) => {
                      const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

                      return (
                        <div key={index} className="border border-[#E5D8C5] rounded-xl p-4 bg-[#FAF7F2] space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_0.65fr_0.8fr_0.8fr_auto] gap-3 items-end">
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                              <select
                                value={item.procedureId}
                                onChange={(e) => handleBudgetProcedureSelect(index, e.target.value)}
                                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
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
                                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
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
                                className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 block mb-1.5">Total</label>
                              <div className="w-full border border-[#E5D8C5] bg-white rounded-xl p-3 text-sm text-gray-500">
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
                              className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#314D3E]">Subtotal</span>
                    <strong className="text-[#314D3E]">
                      {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-center">
                    <label className="text-sm text-[#314D3E]">Desconto (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetForm.discount}
                      onChange={(e) => setBudgetForm((current) => ({ ...current, discount: e.target.value }))}
                      className="border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-rose-100 pt-3">
                    <span className="text-base font-bold text-[#314D3E]">Total</span>
                    <strong className="text-lg text-pink-600">
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
                    className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { resetBudgetForm(); setShowBudgetForm(false); }}
                    className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm hover:bg-[#EFE7DA] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createBudget}
                    className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                  >
                    Criar orçamento
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
                <div key={budget.id} className="bg-white border border-[#E5D8C5] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-semibold text-[#314D3E]">{budget.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Criado em {new Date(budget.createdAt).toLocaleDateString("pt-BR")}
                        {budget.validUntil ? ` · válido até ${new Date(budget.validUntil).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold text-[#314D3E]">
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

                  <div className="divide-y divide-[#EFE7DA] border border-[#EFE7DA] rounded-xl overflow-hidden">
                    {budget.items.map((item) => (
                      <div key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-[#314D3E] truncate">{item.procedureName}</p>
                          {item.observation && (
                            <p className="text-xs text-gray-400 truncate">{item.observation}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {item.quantity} x {item.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {budget.observations && (
                    <p className="text-sm text-gray-500 mt-3">{budget.observations}</p>
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
      {activeTab === "timeline" && (
        <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6">
          <h2 className="text-xl font-bold text-[#314D3E] mb-6">Timeline</h2>
          {(() => {
            const items = [
              ...evolutions.map((e) => ({
                type: "evolution",
                date: new Date(e.createdAt),
                label: e.procedure || "Evolução",
                detail: e.description,
                sub: e.materials ? `Materiais: ${e.materials}` : null,
              })),
              ...appointments.map((a) => ({
                type: "appointment",
                date: new Date(a.startsAt),
                label: a.procedureType || a.title || "Agendamento",
                detail: a.professional || "",
                sub: a.notes || null,
              })),
            ].sort((a, b) => b.date - a.date);

            if (items.length === 0)
              return <p className="text-gray-500">Nenhum evento registrado.</p>;

            return (
              <div className="relative border-l-2 border-[#E5D8C5] pl-6 space-y-6">
                {items.map((item, i) => (
                  <div key={i} className="relative">
                    <span
                      className={`absolute -left-7.25 w-4 h-4 rounded-full border-2 border-white ${
                        item.type === "evolution"
                          ? "bg-[#314D3E]"
                          : "bg-[#D8C3A5]"
                      }`}
                    />
                    <div className="bg-white border border-[#E5D8C5] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            item.type === "evolution"
                              ? "bg-green-100 text-green-700"
                              : "bg-[#EFE7DA] text-[#314D3E]"
                          }`}
                        >
                          {item.type === "evolution" ? "Evolução" : "Agendamento"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {item.date.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="font-semibold text-[#314D3E] mt-1">{item.label}</p>
                      {item.detail && (
                        <p className="text-sm text-gray-600 mt-1">{item.detail}</p>
                      )}
                      {item.sub && (
                        <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* MAPA */}
      {activeTab === "mapa" && (
        <ProcedureMapTab patientId={id} procedures={procedures} />
      )}

      {/* SESSÕES */}
      {activeTab === "sessions" && (
        <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6">
          <h2 className="text-xl font-bold text-[#314D3E] mb-6">Sessões</h2>

          {appointments.length === 0 ? (
            <p className="text-gray-500">Nenhuma sessão registrada.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="bg-white border border-[#E5D8C5] rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#314D3E]">
                      {appt.procedureType || appt.title || "Agendamento"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {appt.professional || "—"}
                      {appt.notes ? ` · ${appt.notes}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-[#314D3E]">
                      {new Date(appt.startsAt).toLocaleDateString("pt-BR")}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        appt.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : appt.status === "CANCELED"
                          ? "bg-red-100 text-red-600"
                          : appt.status === "CONFIRMED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {appt.status === "COMPLETED"
                        ? "Realizado"
                        : appt.status === "CANCELED"
                        ? "Cancelado"
                        : appt.status === "CONFIRMED"
                        ? "Confirmado"
                        : "Agendado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}

function Card({
  title,
  value,
}) {
  return (
    <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <h2 className="text-lg font-semibold text-[#314D3E] mt-1">
        {value || "-"}
      </h2>
    </div>
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
      className={`px-4 py-2 rounded-xl text-sm transition ${
        active
          ? "bg-[#314D3E] text-white"
          : "text-[#314D3E] hover:bg-[#EFE7DA]"
      }`}
    >
      {children}
    </button>
  );
}

function Placeholder({
  title,
}) {
  return (
    <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-10 text-center">
      <h2 className="text-2xl font-bold text-[#314D3E] mb-2">
        {title}
      </h2>

      <p className="text-gray-500">
        Módulo em construção.
      </p>
    </div>
  );
}
