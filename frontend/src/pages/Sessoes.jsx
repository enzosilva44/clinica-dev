import { useEffect, useMemo, useState } from "react";
import { Layers, Search, Star, FileText, Plus, Trash2, Check, Package } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button } from "../components/ui";
import ProtocolsTab from "../components/sessions/ProtocolsTab";
import api from "../services/api";
import toast from "react-hot-toast";

// Barra de progresso realizado/contratado.
function ProgressBar({ done, contracted }) {
  const pct = contracted > 0 ? Math.min((done / contracted) * 100, 100) : 0;
  const complete = done >= contracted;
  return (
    <div className="w-full h-2 rounded-full bg-creme-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${complete ? "bg-verde" : "bg-verde/70"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function OriginBadge({ origin }) {
  const isClub = origin === "club";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
        isClub ? "bg-amber-100 text-amber-700" : "bg-verde-50 text-verde-900"
      }`}
    >
      {isClub ? <Star size={11} /> : <FileText size={11} />}
      {isClub ? "Clube" : "Orçamento"}
    </span>
  );
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("pt-BR");
}

// Card de um pacote (procedimento contratado com saldo de sessões).
function PackageCard({ pkg, onRegister, onRemoveSession, busy }) {
  const [open, setOpen] = useState(false);
  const remaining = pkg.remaining;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <OriginBadge origin={pkg.origin} />
          </div>
          <h3 className="font-semibold text-verde-900 truncate">
            {pkg.origin === "budget" ? pkg.title : pkg.procedureName}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {pkg.patient?.name}
            {pkg.origin === "budget" && pkg.includedProcedures?.length > 0 && ` · ${pkg.includedProcedures.join(", ")}`}
            {pkg.origin === "club" && ` · ${pkg.title}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-verde-900 leading-none">
            {pkg.done}<span className="text-gray-400 text-sm">/{pkg.contracted}</span>
          </p>
          <p className="text-[11px] text-gray-500">realizadas</p>
        </div>
      </div>

      <ProgressBar done={pkg.done} contracted={pkg.contracted} />

      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>
          <b className="text-verde-900">{pkg.contracted}</b> contratadas · <b className="text-verde-900">{pkg.done}</b> feitas · <b className="text-verde-900">{remaining}</b> restantes
        </span>
        {pkg.sessions.length > 0 && (
          <span className="text-gray-400 shrink-0">última: {formatDate(pkg.sessions[0].performedAt)}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${remaining === 0 ? "text-verde" : "text-gray-600"}`}>
          {remaining === 0 ? (
            <span className="inline-flex items-center gap-1"><Check size={13} /> Pacote concluído</span>
          ) : (
            `${remaining} restante${remaining > 1 ? "s" : ""}`
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {pkg.sessions.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-verde hover:underline"
            >
              {open ? "ocultar" : "histórico"}
            </button>
          )}
          <button
            onClick={() => onRegister(pkg)}
            disabled={remaining === 0 || busy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-verde hover:bg-verde-700 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
          >
            <Plus size={13} /> Registrar sessão
          </button>
        </div>
      </div>

      {open && pkg.sessions.length > 0 && (
        <div className="border-t border-creme-200 pt-2 flex flex-col gap-1">
          {pkg.sessions.map((s, idx) => (
            <div key={s.id} className="flex items-start justify-between text-xs text-gray-600">
              <span className="flex items-start gap-1.5 min-w-0">
                <Check size={12} className="text-verde mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="text-gray-500">Sessão {pkg.sessions.length - idx} · </span>
                  {formatDate(s.performedAt)}
                  {s.appointmentId && <span className="text-gray-400"> · via agenda</span>}
                  {Array.isArray(s.procedures) && s.procedures.length > 0 && (
                    <span className="block text-gray-400 truncate">
                      {s.procedures.map((p) => p.procedureName).join(", ")}
                    </span>
                  )}
                </span>
              </span>
              <button
                onClick={() => onRemoveSession(pkg, s)}
                disabled={busy}
                className="text-gray-400 hover:text-red-500 transition disabled:opacity-40 shrink-0 ml-2"
                title="Desfazer sessão"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Sessoes() {
  const [tab, setTab] = useState("pacotes"); // pacotes | protocolos
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos"); // todos | club | budget | pendentes
  const [sessionModal, setSessionModal] = useState(null); // { pkg, selected: [names] }

  async function load() {
    try {
      const { data } = await api.get("/packages/overview");
      setPackages(data);
    } catch {
      toast.error("Erro ao carregar pacotes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return packages.filter((p) => {
      if (filter === "club" && p.origin !== "club") return false;
      if (filter === "budget" && p.origin !== "budget") return false;
      if (filter === "pendentes" && p.remaining === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.patient?.name?.toLowerCase().includes(q) &&
          !p.procedureName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [packages, filter, search]);

  // Para pacote de orçamento com procedimentos inclusos, abre modal p/ escolher
  // quais foram feitos na sessão. Club registra direto (1 procedimento por item).
  function onRegisterClick(pkg) {
    if (pkg.origin === "budget" && pkg.includedProcedures?.length > 0) {
      setSessionModal({ pkg, selected: [] });
    } else {
      handleRegister(pkg, null);
    }
  }

  async function handleRegister(pkg, procedures) {
    setBusy(true);
    try {
      if (pkg.origin === "budget") {
        await api.post(`/budgets/${pkg.sourceId}/sessions`, procedures ? { procedures } : {});
      } else {
        await api.post(`/club/members/${pkg.sourceId}/applications`, {
          planItemId: pkg.itemId,
        });
      }
      toast.success("Sessão registrada");
      setSessionModal(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao registrar sessão");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSession(pkg, session) {
    setBusy(true);
    try {
      if (pkg.origin === "budget") {
        await api.delete(`/budgets/sessions/${session.id}`);
      } else {
        await api.delete(`/club/applications/${session.id}`);
      }
      toast.success("Sessão removida");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao remover sessão");
    } finally {
      setBusy(false);
    }
  }

  const FILTERS = [
    { key: "todos", label: "Todos" },
    { key: "pendentes", label: "Em andamento" },
    { key: "club", label: "Clube" },
    { key: "budget", label: "Orçamento" },
  ];

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="text-verde" size={24} />
          <h1 className="font-serif font-light text-2xl sm:text-3xl text-verde-900">Sessões</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Pacotes de sessões contratados — Clube e orçamentos aprovados. O saldo baixa ao
          concluir o agendamento vinculado ou ao registrar aqui.
        </p>

        {/* Abas: pacotes ativos × protocolos (templates reutilizáveis) */}
        <div className="flex gap-1.5 mb-5 border-b border-creme-200">
          {[
            { key: "pacotes", label: "Pacotes ativos", icon: Layers },
            { key: "protocolos", label: "Protocolos", icon: Package },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -mb-px border-b-2 transition ${
                tab === t.key
                  ? "border-verde text-verde-900"
                  : "border-transparent text-gray-500 hover:text-verde"
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "protocolos" ? (
          <ProtocolsTab />
        ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente ou procedimento…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-creme-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-verde/30"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs font-medium px-3 py-2 rounded-xl whitespace-nowrap transition ${
                  filter === f.key ? "bg-verde text-white" : "bg-white border border-creme-200 text-verde hover:bg-creme-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-creme-100 flex items-center justify-center mb-3">
              <Layers className="text-verde/60" size={26} />
            </div>
            <h2 className="text-lg font-semibold text-verde-900 mb-1">Nenhum pacote ativo</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Pacotes aparecem aqui quando um paciente assina um plano do Clube ou quando um
              orçamento é aprovado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((pkg) => (
              <PackageCard
                key={`${pkg.origin}-${pkg.itemId}`}
                pkg={pkg}
                busy={busy}
                onRegister={onRegisterClick}
                onRemoveSession={handleRemoveSession}
              />
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {tab === "pacotes" && sessionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSessionModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-verde-900 mb-1">Registrar sessão</h2>
            <p className="text-sm text-gray-500 mb-4">
              {sessionModal.pkg.patient?.name} · {sessionModal.pkg.title}
            </p>
            <p className="text-xs font-medium text-gray-500 mb-2">
              Quais procedimentos foram feitos nesta sessão?
            </p>
            <div className="flex flex-col gap-1.5 mb-5 max-h-64 overflow-y-auto">
              {sessionModal.pkg.includedProcedures.map((name, i) => {
                const checked = sessionModal.selected.includes(name);
                return (
                  <label key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-creme-200 cursor-pointer hover:bg-creme-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSessionModal((m) => ({
                        ...m,
                        selected: checked ? m.selected.filter((n) => n !== name) : [...m.selected, name],
                      }))}
                      className="accent-verde"
                    />
                    <span className="text-sm text-verde-900">{name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSessionModal(null)}
                disabled={busy}
                className="text-sm text-gray-600 px-4 py-2 rounded-xl hover:bg-creme-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRegister(
                  sessionModal.pkg,
                  sessionModal.selected.map((name) => ({ procedureName: name })),
                )}
                disabled={busy}
                className="text-sm font-semibold text-white bg-verde hover:bg-verde-700 px-4 py-2 rounded-xl transition disabled:opacity-50"
              >
                {busy ? "Registrando…" : "Registrar sessão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
