import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Users, Search, Sparkles, X, Upload } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button } from "../components/ui";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";
import ImportPatientsModal from "../components/patients/ImportPatientsModal";
import { useIsMobile } from "../hooks/useIsMobile";
import PatientsMobile from "./patients/PatientsMobile";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function calcAge(birthDate) {
  if (!birthDate) return "—";
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

function relativeDate(date) {
  if (!date) return "—";
  const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 30) return `${diff}d atrás`;
  if (diff < 365) return `${Math.floor(diff / 30)}m atrás`;
  return new Date(date).toLocaleDateString("pt-BR");
}

// Faixas de recência do último agendamento — verde ≤30d, âmbar 30-90d, vermelho >90d/nunca.
function recencyColor(date) {
  if (!date) return "#E2574C";
  const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (diff <= 30) return "#3A9B6F";
  if (diff <= 90) return "#C4895A";
  return "#E2574C";
}

export default function Patients() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sortBy, setSortBy] = useState("name_asc");
  const [counts, setCounts] = useState({ active: null, removed: null });
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showImport, setShowImport] = useState(false);

  async function loadReturnSuggestions() {
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const res = await api.get("/ai/return-suggestions");
      setSuggestions(res.data.suggestions);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function loadPatients() {
    try {
      const res = await api.get("/patients", { params: { page, search, status, sortBy } });
      setPatients(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    try {
      const [activeRes, removedRes] = await Promise.all([
        api.get("/patients", { params: { page: 1, status: "active" } }),
        api.get("/patients", { params: { page: 1, status: "removed" } }),
      ]);
      setCounts({ active: activeRes.data.total, removed: removedRes.data.total });
    } catch {
      setCounts({ active: null, removed: null });
    }
  }

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadPatients, 400);
    return () => clearTimeout(t);
  }, [page, search, status, sortBy]);

  useEffect(() => {
    loadCounts();
  }, []);

  if (isMobile) {
    return (
      <MainLayout>
        {showImport && (
          <ImportPatientsModal
            onClose={() => setShowImport(false)}
            onSuccess={() => { setPage(1); loadPatients(); loadCounts(); }}
          />
        )}
        <PatientsMobile
          patients={patients}
          search={search}
          setSearch={(v) => { setSearch(v); setPage(1); }}
          status={status}
          setStatus={(v) => { setStatus(v); setPage(1); }}
          sortBy={sortBy}
          setSortBy={(v) => { setSortBy(v); setPage(1); }}
          total={total}
          onOpenPatient={(id) => navigate(`/patients/${id}`)}
          onCreate={() => navigate("/patients/create")}
          onSuggestions={loadReturnSuggestions}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {showImport && (
        <ImportPatientsModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setPage(1); loadPatients(); loadCounts(); }}
        />
      )}
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Pacientes</h1>
          <p className="text-gray-500 mt-1">
            {counts.active != null
              ? `${counts.active} ativos · ${counts.removed} inativos`
              : "Gerencie os pacientes da clínica"}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="md" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Importar CSV
          </Button>
          <Button
            size="md"
            disabled={loadingSuggestions}
            onClick={loadReturnSuggestions}
            className="!bg-[#F3EEFB] !text-[#7C53C9] hover:!bg-[#E9DEF8] !shadow-none"
          >
            <Sparkles size={15} className={loadingSuggestions ? "animate-pulse" : ""} />
            {loadingSuggestions ? "Analisando…" : "Sugestões IA"}
          </Button>
          <Button size="md" onClick={() => navigate("/patients/create")}>
            <Plus size={16} /> Novo paciente
          </Button>
        </div>
      </div>

      {/* SUGESTÕES DE RETORNO IA */}
      {showSuggestions && (
        <div className="relative bg-gradient-to-br from-verde-900 to-verde-950 rounded-2xl p-5 mb-6 text-white">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-[#7C53C9]/30 flex items-center justify-center shrink-0">
              <Sparkles size={13} className="text-[#C9B2F0]" />
            </div>
            <span className="text-[13.5px] font-bold text-[#C9B2F0]">Sugestões de retorno</span>
            {suggestions.length > 0 && (
              <span className="text-[11px] text-white/35 ml-auto">
                {suggestions.length} paciente{suggestions.length !== 1 ? "s" : ""} valem um contato esta semana
              </span>
            )}
            <button onClick={() => setShowSuggestions(false)} className="text-white/40 hover:text-white transition shrink-0">
              <X size={16} />
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-4">
              Nenhum paciente para reativar no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/[.09] rounded-xl p-3.5">
                  <p className="text-[13.5px] font-bold">{s.name}</p>
                  <p className="text-[11.5px] text-white/55 leading-relaxed my-1.5 line-clamp-3">{s.suggestion}</p>
                  <button
                    onClick={() => {
                      const p = patients.find((pt) => pt.name === s.name);
                      if (p) navigate(`/patients/${p.id}`);
                    }}
                    className="bg-white/10 hover:bg-white/20 transition text-white text-[11.5px] font-semibold rounded-lg px-2.5 py-1.5"
                  >
                    Sugerir retorno
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEARCH + FILTRO */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, telefone ou CPF…"
            className="w-full pl-10 pr-4 py-2.5 border border-ambar rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
          />
        </div>
        <div className="flex gap-1 bg-creme-50 border border-creme-200 rounded-xl p-1">
          {[["active", "Ativos"], ["removed", "Inativos"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setStatus(v); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm transition font-medium ${
                status === v ? "bg-verde text-white" : "text-verde hover:bg-creme-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="border border-ambar rounded-xl px-3 py-2.5 text-sm bg-white text-verde focus:outline-none focus:ring-2 focus:ring-verde/20 cursor-pointer"
          aria-label="Ordenar pacientes"
        >
          <option value="name_asc">Nome (A–Z)</option>
          <option value="name_desc">Nome (Z–A)</option>
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : patients.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
            <Users size={28} className="text-ambar" />
          </div>
          <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum paciente cadastrado</h2>
          <p className="text-gray-500 mb-6 max-w-xs">Comece cadastrando o primeiro paciente da clínica.</p>
          <Button onClick={() => navigate("/patients/create")}>
            <Plus size={16} /> Novo paciente
          </Button>
        </div>
      ) : (
        <>
          <Card className="bg-white! p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-creme-100">
                  <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide hidden md:table-cell">Idade</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-[11px] font-bold uppercase tracking-wide hidden md:table-cell">Último agendamento</th>
                  <th className="px-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="border-t border-creme-200 cursor-pointer hover:bg-creme-50 transition group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8.5 h-8.5 rounded-full bg-verde text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                          {initials(patient.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-verde-900 leading-tight">{patient.name}</p>
                          {patient.email && (
                            <p className="text-xs text-gray-400 mt-0.5">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 font-mono">{patient.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">{calcAge(patient.birthDate)}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: recencyColor(patient.lastAppointment) }} />
                        <span className="text-xs text-gray-500">{relativeDate(patient.lastAppointment)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">→</span>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-14 text-center text-gray-400 text-sm">
                      Nenhum resultado para <span className="font-medium text-verde">"{search}"</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-creme-200 flex-wrap gap-3">
              <div className="flex items-center gap-3.5 flex-wrap">
                <span className="text-xs text-gray-400">
                  {patients.length > 0
                    ? `${(page - 1) * 10 + 1}–${(page - 1) * 10 + patients.length} de ${total} pacientes`
                    : `0 de ${total} pacientes`}
                </span>
                <span className="flex items-center gap-3.5 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-1.75 h-1.75 rounded-full bg-[#3A9B6F]" />até 30 dias</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.75 h-1.75 rounded-full bg-[#C4895A]" />30–90 dias</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.75 h-1.75 rounded-full bg-[#E2574C]" />mais de 90</span>
                </span>
              </div>
              <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
            </div>
          </Card>

          {/* PAGINAÇÃO */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="border border-ambar px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-creme-100 transition"
              >
                ← Anterior
              </button>
              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-xl text-sm transition font-medium ${
                      p === page ? "bg-verde text-white" : "border border-ambar hover:bg-creme-100 text-verde"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border border-ambar px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-creme-100 transition"
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
