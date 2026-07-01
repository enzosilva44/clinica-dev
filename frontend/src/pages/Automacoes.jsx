import { useEffect, useState } from "react";
import {
  MessageSquare, History, ToggleLeft, ToggleRight,
  Edit2, Save, X, RefreshCw, CheckCircle, XCircle, Clock,
  Cake, UserPlus, CalendarCheck, Bell, Wifi, WifiOff, Eye, EyeOff, Send,
  BarChart2, TrendingUp, DollarSign, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

const TYPE_META = {
  birthday:     { label: "Feliz aniversário",        icon: Cake,          color: "#C4895A", desc: "Enviada no dia do aniversário do paciente (todos os dias às 09h)." },
  welcome:      { label: "Boas-vindas",               icon: UserPlus,      color: "#00704A", desc: "Enviada automaticamente ao cadastrar um novo paciente." },
  confirmation: { label: "Confirmação de agendamento", icon: CalendarCheck, color: "#6F7F73", desc: "Enviada ao criar um novo agendamento." },
  reminder:     { label: "Lembrete de consulta",      icon: Bell,          color: "#8B6B4E", desc: "Enviada X horas antes da consulta (configurável)." },
};

const VARS = {
  birthday:     ["{{nome}}"],
  welcome:      ["{{nome}}"],
  confirmation: ["{{nome}}", "{{data}}", "{{hora}}"],
  reminder:     ["{{nome}}", "{{data}}", "{{hora}}"],
};

const STATUS_STYLE = {
  sent:    { label: "Enviado",   icon: CheckCircle, cls: "text-green-600 bg-green-50" },
  failed:  { label: "Falhou",    icon: XCircle,     cls: "text-red-500 bg-red-50" },
  pending: { label: "Pendente",  icon: Clock,       cls: "text-yellow-600 bg-yellow-50" },
  skipped: { label: "Ignorado",  icon: X,           cls: "text-gray-400 bg-gray-50" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      <Icon size={11} />{s.label}
    </span>
  );
}

function TemplateCard({ tpl, onSave }) {
  const meta = TYPE_META[tpl.type] ?? {};
  const Icon = meta.icon ?? MessageSquare;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(tpl.body);
  const [reminderHours, setReminderHours] = useState(tpl.reminderHoursBefore ?? 24);
  const [active, setActive] = useState(tpl.isActive);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = { name: tpl.name, body, isActive: active };
      if (tpl.type === "reminder") payload.reminderHoursBefore = reminderHours;
      await api.put(`/automations/templates/${tpl.type}`, payload);
      onSave();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next = !active;
    setActive(next);
    await api.put(`/automations/templates/${tpl.type}`, { name: tpl.name, body, isActive: next }).catch(() => setActive(!next));
    onSave();
  }

  return (
    <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + "22" }}>
            <Icon size={17} style={{ color: meta.color }} />
          </div>
          <div>
            <p className="font-semibold text-sm text-[#00704A]">{meta.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
          </div>
        </div>
        <button onClick={toggleActive} className="shrink-0 mt-0.5">
          {active
            ? <ToggleRight size={26} className="text-[#00704A]" />
            : <ToggleLeft  size={26} className="text-gray-300" />}
        </button>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(VARS[tpl.type] ?? []).map((v) => (
                <button
                  key={v}
                  onClick={() => setBody((b) => b + v)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFE7DA] text-[#00704A] font-mono hover:bg-[#C4895A] transition"
                >
                  {v}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full border border-[#C4895A] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20 resize-none"
            />
          </div>

          {tpl.type === "reminder" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Enviar</label>
              <input
                type="number" min={1} max={72}
                value={reminderHours}
                onChange={(e) => setReminderHours(+e.target.value)}
                className="w-16 border border-[#C4895A] rounded-lg px-2 py-1 text-sm text-center focus:outline-none"
              />
              <label className="text-xs text-gray-500">horas antes da consulta</label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#00704A] hover:bg-[#0A3326] text-white px-4 py-2 rounded-xl text-xs font-medium transition disabled:opacity-50"
            >
              <Save size={13} />{saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => { setBody(tpl.body); setEditing(false); }}
              className="flex items-center gap-1.5 border border-[#C4895A] hover:bg-[#EFE7DA] text-[#00704A] px-3 py-2 rounded-xl text-xs font-medium transition"
            >
              <X size={13} />Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-gray-500 bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl px-3 py-2.5 leading-relaxed">
            {tpl.body}
          </p>
          {tpl.type === "reminder" && (
            <p className="text-xs text-gray-400 mt-1.5">
              Lembrete enviado <span className="font-medium text-[#00704A]">{tpl.reminderHoursBefore ?? 24}h</span> antes da consulta.
            </p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-[#00704A] hover:opacity-70 transition font-medium"
          >
            <Edit2 size={12} />Editar mensagem
          </button>
        </div>
      )}
    </div>
  );
}

export default function Automacoes() {
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [triggering, setTriggering] = useState("");

  // Usage stats
  const [stats, setStats] = useState(null);
  const [tier, setTier] = useState("tier1");

  const TIERS = {
    test:  { label: "Teste",    limit: 250 },
    tier1: { label: "Tier 1",   limit: 1000 },
    tier2: { label: "Tier 2",   limit: 10000 },
    tier3: { label: "Tier 3",   limit: 100000 },
  };

  // WhatsApp config
  const [wpConfig, setWpConfig] = useState({ configured: false, phoneNumberId: "", hasToken: false });
  const [wpPhoneNumberId, setWpPhoneNumberId] = useState("");
  const [wpAccessToken, setWpAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingWp, setSavingWp] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testingWp, setTestingWp] = useState(false);

  async function loadStats() {
    try {
      const res = await api.get("/automations/usage-stats");
      setStats(res.data);
    } catch {/* */}
  }

  async function loadWpConfig() {
    try {
      const res = await api.get("/automations/whatsapp-config");
      setWpConfig(res.data);
      setWpPhoneNumberId(res.data.phoneNumberId || "");
    } catch {/* */}
  }

  async function saveWpConfig() {
    setSavingWp(true);
    try {
      await api.put("/automations/whatsapp-config", { phoneNumberId: wpPhoneNumberId, accessToken: wpAccessToken || undefined });
      await loadWpConfig();
      setWpAccessToken("");
      toast.success("Configuração salva!");
    } catch {
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSavingWp(false);
    }
  }

  async function sendTestMessage() {
    if (!testPhone) return;
    setTestingWp(true);
    try {
      await api.post("/automations/whatsapp-test", { phone: testPhone });
      toast.success("Mensagem de teste enviada!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao enviar teste.");
    } finally {
      setTestingWp(false);
    }
  }

  async function loadTemplates() {
    setLoadingTpl(true);
    try {
      const res = await api.get("/automations/templates");
      setTemplates(res.data);
    } finally {
      setLoadingTpl(false);
    }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await api.get("/automations/logs", { params: { page: logPage, type: filterType || undefined } });
      setLogs(res.data.data);
      setLogTotal(res.data.total);
      setLogTotalPages(res.data.totalPages);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => { loadTemplates(); loadWpConfig(); }, []);
  useEffect(() => { if (tab === "historico") loadLogs(); }, [tab, logPage, filterType]);
  useEffect(() => { if (tab === "resumo") loadStats(); }, [tab]);

  async function triggerManual(type) {
    setTriggering(type);
    try {
      await api.post(`/automations/trigger/${type}`);
      if (tab === "historico") loadLogs();
    } finally {
      setTriggering("");
    }
  }

  const typeOrder = ["birthday", "welcome", "confirmation", "reminder"];
  const sorted = [...templates].sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#00704A]">Automações</h1>
          <p className="text-gray-500 mt-1 text-sm">Mensagens automáticas via WhatsApp</p>
        </div>
      </div>

      {/* STATUS WHATSAPP */}
      {wpConfig.configured ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-6 text-sm text-green-800">
          <Wifi size={16} className="shrink-0 text-green-600" />
          <span><strong>WhatsApp conectado.</strong> Automações ativas e enviando mensagens reais.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 text-sm text-amber-800">
          <WifiOff size={16} className="shrink-0 text-amber-500" />
          <span><strong>WhatsApp não configurado.</strong> Configure na aba <button onClick={() => setTab("conexao")} className="underline font-semibold">Conexão</button> para ativar os envios.</span>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl p-1 mb-6 w-fit">
        {[["templates", MessageSquare, "Templates"], ["historico", History, "Histórico"], ["conexao", Wifi, "Conexão"], ["resumo", BarChart2, "Resumo"]].map(([v, Icon, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === v ? "bg-[#00704A] text-white" : "text-[#00704A] hover:bg-[#EFE7DA]"
            }`}
          >
            <Icon size={14} />{l}
          </button>
        ))}
      </div>

      {/* TEMPLATES TAB */}
      {tab === "templates" && (
        <>
          {loadingTpl ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sorted.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} onSave={loadTemplates} />
              ))}
            </div>
          )}

          <div className="mt-6 bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#00704A] mb-3">Testar disparo manual</p>
            <div className="flex flex-wrap gap-2">
              {[["birthday", "Aniversários de hoje"], ["reminder", "Lembretes pendentes"]].map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => triggerManual(type)}
                  disabled={!!triggering}
                  className="flex items-center gap-2 border border-[#C4895A] hover:bg-[#EFE7DA] text-[#00704A] px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  <RefreshCw size={13} className={triggering === type ? "animate-spin" : ""} />
                  {triggering === type ? "Executando…" : label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* CONEXÃO TAB */}
      {tab === "conexao" && (
        <div className="max-w-lg space-y-6">
          {/* Status */}
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${wpConfig.configured ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            {wpConfig.configured
              ? <Wifi size={20} className="text-green-600 shrink-0" />
              : <WifiOff size={20} className="text-amber-500 shrink-0" />}
            <div>
              <p className={`font-semibold text-sm ${wpConfig.configured ? "text-green-800" : "text-amber-800"}`}>
                {wpConfig.configured ? "WhatsApp conectado" : "Não configurado"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {wpConfig.configured ? "Mensagens automáticas estão ativas." : "Preencha as credenciais abaixo para ativar."}
              </p>
            </div>
          </div>

          {/* Formulário de credenciais */}
          <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-sm text-[#00704A]">Credenciais Meta Cloud API</p>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Phone Number ID</label>
              <input
                value={wpPhoneNumberId}
                onChange={(e) => setWpPhoneNumberId(e.target.value)}
                placeholder="Ex: 4578512252473592"
                className="w-full border border-[#C4895A] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Access Token {wpConfig.hasToken && <span className="text-green-600 font-normal">(já configurado — deixe em branco para manter)</span>}
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={wpAccessToken}
                  onChange={(e) => setWpAccessToken(e.target.value)}
                  placeholder={wpConfig.hasToken ? "••••••••••••••••" : "Cole o Access Token aqui"}
                  className="w-full border border-[#C4895A] rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              onClick={saveWpConfig}
              disabled={savingWp || !wpPhoneNumberId}
              className="flex items-center gap-2 bg-[#00704A] hover:bg-[#0A3326] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              <Save size={14} />{savingWp ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>

          {/* Teste de envio */}
          {wpConfig.configured && (
            <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-sm text-[#00704A]">Testar envio</p>
              <p className="text-xs text-gray-500">Envia uma mensagem de teste para confirmar que a integração está funcionando.</p>
              <div className="flex gap-2">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="55119999999999"
                  className="flex-1 border border-[#C4895A] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                />
                <button
                  onClick={sendTestMessage}
                  disabled={testingWp || !testPhone}
                  className="flex items-center gap-2 bg-[#00704A] hover:bg-[#0A3326] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  <Send size={14} />{testingWp ? "Enviando…" : "Testar"}
                </button>
              </div>
              <p className="text-xs text-gray-400">Formato: código do país + DDD + número (ex: 5511999998888)</p>
            </div>
          )}
        </div>
      )}

      {/* HISTÓRICO TAB */}
      {tab === "historico" && (
        <>
          {/* Filtro */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[["", "Todos"], ...Object.entries(TYPE_META).map(([k, v]) => [k, v.label])].map(([v, l]) => (
              <button
                key={v}
                onClick={() => { setFilterType(v); setLogPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                  filterType === v
                    ? "bg-[#00704A] text-white border-[#00704A]"
                    : "border-[#C4895A] text-[#00704A] hover:bg-[#EFE7DA]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {loadingLogs ? (
            <Spinner />
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhum envio registrado ainda.
            </div>
          ) : (
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5D8C5] bg-[#EFE7DA] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#00704A]">Histórico de envios</span>
                <span className="text-xs text-gray-500">{logTotal} registro{logTotal !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5D8C5]">
                      <th className="text-left px-5 py-3 text-[#00704A] text-xs font-semibold uppercase tracking-wide">Paciente</th>
                      <th className="text-left px-5 py-3 text-[#00704A] text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                      <th className="text-left px-5 py-3 text-[#00704A] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Mensagem</th>
                      <th className="text-left px-5 py-3 text-[#00704A] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Data</th>
                      <th className="text-left px-5 py-3 text-[#00704A] text-xs font-semibold uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const meta = TYPE_META[log.type];
                      const Icon = meta?.icon ?? MessageSquare;
                      return (
                        <tr key={log.id} className="border-t border-[#E5D8C5] hover:bg-[#F3EEE5] transition">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-[#00704A]">{log.patientName}</p>
                            <p className="text-xs text-gray-400">{log.phone}</p>
                          </td>
                          <td className="px-5 py-3.5 hidden sm:table-cell">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Icon size={12} style={{ color: meta?.color }} />
                              {meta?.label ?? log.type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell max-w-xs">
                            <p className="text-xs text-gray-500 truncate">{log.message}</p>
                          </td>
                          <td className="px-5 py-3.5 hidden md:table-cell text-xs text-gray-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={log.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {logTotalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <button
                disabled={logPage === 1}
                onClick={() => setLogPage((p) => p - 1)}
                className="border border-[#C4895A] px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-[#EFE7DA] transition"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">Página {logPage} de {logTotalPages}</span>
              <button
                disabled={logPage === logTotalPages}
                onClick={() => setLogPage((p) => p + 1)}
                className="border border-[#C4895A] px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-[#EFE7DA] transition"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
      {/* RESUMO TAB */}
      {tab === "resumo" && (() => {
        const dailyLimit = TIERS[tier].limit;
        const todayConv  = stats?.today?.conversations ?? 0;
        const pct        = Math.min(100, Math.round((todayConv / dailyLimit) * 100));
        const barColor   = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-yellow-400" : "bg-green-500";

        return (
          <div className="space-y-6 max-w-2xl">

            {/* Tier selector */}
            <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#00704A] mb-3">Seu tier Meta WhatsApp</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIERS).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTier(key)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition border ${
                      tier === key
                        ? "bg-[#00704A] text-white border-[#00704A]"
                        : "border-[#C4895A] text-[#00704A] hover:bg-[#EFE7DA]"
                    }`}
                  >
                    {t.label} — {t.limit.toLocaleString("pt-BR")}/dia
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Novos apps começam no Tier 1. Sobe automaticamente com volume e verificação da conta.
              </p>
            </div>

            {/* Uso hoje */}
            <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#00704A]">Conversas hoje</p>
                {pct >= 80 && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                    <AlertTriangle size={13} />Próximo do limite
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-[#00704A]">{todayConv}</span>
                <span className="text-gray-400 text-sm mb-1">/ {dailyLimit.toLocaleString("pt-BR")} conversas</span>
              </div>
              <div className="w-full bg-[#EFE7DA] rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{pct}% do limite diário utilizado</p>
            </div>

            {/* Este mês */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: MessageSquare,
                  label: "Conversas no mês",
                  value: stats?.thisMonth?.conversations ?? "—",
                  sub: `${stats?.thisMonth?.messages ?? 0} mensagens enviadas`,
                  color: "#00704A",
                },
                {
                  icon: DollarSign,
                  label: "Custo estimado",
                  value: stats?.thisMonth?.estimatedCost != null
                    ? `R$ ${stats.thisMonth.estimatedCost.toFixed(2).replace(".", ",")}`
                    : "R$ 0,00",
                  sub: "valores aproximados Meta BR",
                  color: "#C4895A",
                },
                {
                  icon: TrendingUp,
                  label: "Projeção 30 dias",
                  value: stats?.projections?.estimatedConversations ?? "—",
                  sub: `≈ R$ ${(stats?.projections?.estimatedCost ?? 0).toFixed(2).replace(".", ",")}`,
                  color: "#6F7F73",
                },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="bg-white border border-[#E5D8C5] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <p className="text-xs font-medium text-gray-500">{label}</p>
                  </div>
                  <p className="text-2xl font-bold text-[#00704A]">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </div>
              ))}
            </div>

            {/* Breakdown por tipo */}
            <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#00704A] mb-4">Detalhamento do mês</p>
              <div className="space-y-3">
                {[
                  { type: "birthday",     label: "Aniversários",    icon: Cake,          cost: 0.50, color: "#C4895A" },
                  { type: "welcome",      label: "Boas-vindas",     icon: UserPlus,      cost: 0.50, color: "#00704A" },
                  { type: "confirmation", label: "Confirmações",    icon: CalendarCheck, cost: 0.20, color: "#6F7F73" },
                  { type: "reminder",     label: "Lembretes",       icon: Bell,          cost: 0.20, color: "#8B6B4E" },
                ].map(({ type, label, icon: Icon, cost, color }) => {
                  const count = stats?.thisMonth?.byType?.[type] ?? 0;
                  return (
                    <div key={type} className="flex items-center justify-between py-2 border-b border-[#F0EAE0] last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <span className="text-sm text-[#00704A]">{label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-sm font-semibold text-[#00704A] w-8 text-right">{count}</span>
                        <span className="text-xs text-gray-400 w-20 text-right">
                          R$ {(count * cost).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-xs text-gray-300 w-16 text-right">R$ {cost.toFixed(2).replace(".", ",")}/conv</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                * Preços aproximados para o Brasil. Marketing (aniv./boas-vindas) ≈ R$0,50 · Utilidade (confirm./lembrete) ≈ R$0,20 por conversa de 24h.
              </p>
            </div>

            {/* Projeção próximo mês */}
            <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#00704A] mb-3">Projeção — próximos 30 dias</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Aniversários este mês</p>
                  <p className="font-bold text-[#00704A] text-lg">{stats?.projections?.birthdaysThisMonth ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Agendamentos (30 dias)</p>
                  <p className="font-bold text-[#00704A] text-lg">{stats?.projections?.upcomingAppointments30days ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Conversas estimadas</p>
                  <p className="font-bold text-[#00704A] text-lg">{stats?.projections?.estimatedConversations ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Custo estimado</p>
                  <p className="font-bold text-[#C4895A] text-lg">
                    R$ {(stats?.projections?.estimatedCost ?? 0).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            </div>

          </div>
        );
      })()}

    </MainLayout>
  );
}
