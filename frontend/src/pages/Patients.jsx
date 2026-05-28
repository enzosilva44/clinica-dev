import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Users, Search, Sparkles, X } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

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

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
      const res = await api.get("/patients", { params: { page, search, status } });
      setPatients(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(loadPatients, 400);
    return () => clearTimeout(t);
  }, [page, search, status]);

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#314D3E]">Pacientes</h1>
          <p className="text-gray-500 mt-1">Gerencie os pacientes da clínica</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReturnSuggestions}
            disabled={loadingSuggestions}
            className="flex items-center gap-2 border border-[#D6C1A3] hover:bg-[#EFE7DA] disabled:opacity-50 text-[#314D3E] px-4 py-2.5 rounded-xl transition text-sm font-medium"
          >
            <Sparkles size={15} className={loadingSuggestions ? "animate-pulse" : ""} />
            {loadingSuggestions ? "Analisando…" : "Sugestões de retorno"}
          </button>
          <button
            onClick={() => navigate("/patients/create")}
            className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
          >
            <Plus size={16} /> Novo paciente
          </button>
        </div>
      </div>

      {/* SUGESTÕES DE RETORNO IA */}
      {showSuggestions && (
        <div className="bg-white border border-[#E5D8C5] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#314D3E]" />
              <span className="text-sm font-bold text-[#314D3E]">Pacientes para reativar</span>
              {suggestions.length > 0 && (
                <span className="text-xs bg-[#EFE7DA] text-[#314D3E] px-2 py-0.5 rounded-full font-medium">
                  {suggestions.length} sugestão{suggestions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button onClick={() => setShowSuggestions(false)} className="text-gray-400 hover:text-gray-600 transition">
              <X size={16} />
            </button>
          </div>

          {loadingSuggestions ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-[#FAF7F2] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhum paciente para reativar no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#314D3E]">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.suggestion}</p>
                  </div>
                  <button
                    onClick={() => {
                      const p = patients.find((pt) => pt.name === s.name);
                      if (p) navigate(`/patients/${p.id}`);
                    }}
                    className="text-xs text-[#314D3E] hover:opacity-70 transition shrink-0 ml-4 font-medium"
                  >
                    Ver paciente →
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
            className="w-full pl-10 pr-4 py-2.5 border border-[#D6C1A3] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
          />
        </div>
        <div className="flex gap-1 bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl p-1">
          {[["active", "Ativos"], ["removed", "Inativos"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setStatus(v); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm transition font-medium ${
                status === v ? "bg-[#314D3E] text-white" : "text-[#314D3E] hover:bg-[#EFE7DA]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : patients.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-[#EFE7DA] rounded-2xl flex items-center justify-center mb-4">
            <Users size={28} className="text-[#D6C1A3]" />
          </div>
          <h2 className="text-xl font-semibold text-[#314D3E] mb-2">Nenhum paciente cadastrado</h2>
          <p className="text-gray-500 mb-6 max-w-xs">Comece cadastrando o primeiro paciente da clínica.</p>
          <button
            onClick={() => navigate("/patients/create")}
            className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
          >
            <Plus size={16} /> Novo paciente
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl overflow-hidden shadow-sm">
            {/* Cabeçalho da tabela */}
            <div className="px-5 py-3.5 border-b border-[#E5D8C5] bg-[#EFE7DA] flex items-center justify-between">
              <span className="text-sm font-semibold text-[#314D3E]">
                {search ? `Resultados para "${search}"` : status === "active" ? "Pacientes ativos" : "Pacientes inativos"}
              </span>
              <span className="text-xs text-gray-500">Página {page} de {totalPages}</span>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5D8C5]">
                  <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Idade</th>
                  <th className="text-left px-5 py-3 text-[#314D3E] text-xs font-semibold uppercase tracking-wide hidden md:table-cell">Último agend.</th>
                  <th className="px-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="border-t border-[#E5D8C5] cursor-pointer hover:bg-[#F3EEE5] transition group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#314D3E] text-white text-sm font-semibold flex items-center justify-center shrink-0 select-none">
                          {initials(patient.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#314D3E] leading-tight">{patient.name}</p>
                          {patient.email && (
                            <p className="text-xs text-gray-400 mt-0.5">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{patient.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">{calcAge(patient.birthDate)}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={`text-xs font-medium ${
                        patient.lastAppointment && Math.floor((Date.now() - new Date(patient.lastAppointment)) / 86400000) < 30
                          ? "text-[#314D3E]"
                          : "text-gray-400"
                      }`}>
                        {relativeDate(patient.lastAppointment)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">→</span>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-14 text-center text-gray-400 text-sm">
                      Nenhum resultado para <span className="font-medium text-[#314D3E]">"{search}"</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* PAGINAÇÃO */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-[#EFE7DA] transition"
              >
                ← Anterior
              </button>
              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-xl text-sm transition font-medium ${
                      p === page ? "bg-[#314D3E] text-white" : "border border-[#D6C1A3] hover:bg-[#EFE7DA] text-[#314D3E]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
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
