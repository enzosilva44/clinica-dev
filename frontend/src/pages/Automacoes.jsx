import { useEffect, useState } from "react";
import {
  Zap, MessageSquare, History, ToggleLeft, ToggleRight,
  Edit2, Save, X, RefreshCw, CheckCircle, XCircle, Clock,
  Cake, UserPlus, CalendarCheck, Bell,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

const TYPE_META = {
  birthday:     { label: "Feliz aniversário",        icon: Cake,          color: "#C4895A", desc: "Enviada no dia do aniversário do paciente (todos os dias às 09h)." },
  welcome:      { label: "Boas-vindas",               icon: UserPlus,      color: "#314D3E", desc: "Enviada automaticamente ao cadastrar um novo paciente." },
  confirmation: { label: "Confirmação de agendamento", icon: CalendarCheck, color: "#7C9A92", desc: "Enviada ao criar um novo agendamento." },
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
            <p className="font-semibold text-sm text-[#314D3E]">{meta.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
          </div>
        </div>
        <button onClick={toggleActive} className="shrink-0 mt-0.5">
          {active
            ? <ToggleRight size={26} className="text-[#314D3E]" />
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
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFE7DA] text-[#314D3E] font-mono hover:bg-[#D6C1A3] transition"
                >
                  {v}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full border border-[#D6C1A3] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20 resize-none"
            />
          </div>

          {tpl.type === "reminder" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 shrink-0">Enviar</label>
              <input
                type="number" min={1} max={72}
                value={reminderHours}
                onChange={(e) => setReminderHours(+e.target.value)}
                className="w-16 border border-[#D6C1A3] rounded-lg px-2 py-1 text-sm text-center focus:outline-none"
              />
              <label className="text-xs text-gray-500">horas antes da consulta</label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2 rounded-xl text-xs font-medium transition disabled:opacity-50"
            >
              <Save size={13} />{saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => { setBody(tpl.body); setEditing(false); }}
              className="flex items-center gap-1.5 border border-[#D6C1A3] hover:bg-[#EFE7DA] text-[#314D3E] px-3 py-2 rounded-xl text-xs font-medium transition"
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
              Lembrete enviado <span className="font-medium text-[#314D3E]">{tpl.reminderHoursBefore ?? 24}h</span> antes da consulta.
            </p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-[#314D3E] hover:opacity-70 transition font-medium"
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

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => { if (tab === "historico") loadLogs(); }, [tab, logPage, filterType]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-[#314D3E]">Automações</h1>
          <p className="text-gray-500 mt-1 text-sm">Mensagens automáticas via WhatsApp</p>
        </div>
      </div>

      {/* AVISO MOCK */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 text-sm text-amber-800">
        <Zap size={16} className="shrink-0 mt-0.5 text-amber-500" />
        <span>
          <strong>Modo simulação ativo.</strong> Os disparos estão sendo apenas registrados no histórico.
          Quando você conectar uma API de WhatsApp, basta atualizar o provider no backend.
        </span>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl p-1 mb-6 w-fit">
        {[["templates", MessageSquare, "Templates"], ["historico", History, "Histórico"]].map(([v, Icon, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === v ? "bg-[#314D3E] text-white" : "text-[#314D3E] hover:bg-[#EFE7DA]"
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
            <p className="text-sm font-semibold text-[#314D3E] mb-3">Testar disparo manual</p>
            <div className="flex flex-wrap gap-2">
              {[["birthday", "Aniversários de hoje"], ["reminder", "Lembretes pendentes"]].map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => triggerManual(type)}
                  disabled={!!triggering}
                  className="flex items-center gap-2 border border-[#D6C1A3] hover:bg-[#EFE7DA] text-[#314D3E] px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  <RefreshCw size={13} className={triggering === type ? "animate-spin" : ""} />
                  {triggering === type ? "Executando…" : label}
                </button>
              ))}
            </div>
          </div>
        </>
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
                    ? "bg-[#314D3E] text-white border-[#314D3E]"
                    : "border-[#D6C1A3] text-[#314D3E] hover:bg-[#EFE7DA]"
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
                <span className="text-sm font-semibold text-[#314D3E]">Histórico de envios</span>
                <span className="text-xs text-gray-500">{logTotal} registro{logTotal !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5D8C5]">
                      <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide">Paciente</th>
                      <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                      <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Mensagem</th>
                      <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Data</th>
                      <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const meta = TYPE_META[log.type];
                      const Icon = meta?.icon ?? MessageSquare;
                      return (
                        <tr key={log.id} className="border-t border-[#E5D8C5] hover:bg-[#F3EEE5] transition">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-[#314D3E]">{log.patientName}</p>
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
                className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-[#EFE7DA] transition"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">Página {logPage} de {logTotalPages}</span>
              <button
                disabled={logPage === logTotalPages}
                onClick={() => setLogPage((p) => p + 1)}
                className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-[#EFE7DA] transition"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
