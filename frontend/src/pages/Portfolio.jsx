import { useEffect, useState } from "react";
import { Images, X, Search } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button } from "../components/ui";
import api from "../services/api";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function photoUrl(id) {
  const token = localStorage.getItem("token");
  return `${API_BASE}/photos/${id}/file?token=${encodeURIComponent(token ?? "")}`;
}

function initials(name) {
  return (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const hasHadBirthdayThisYear = now.getMonth() > b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() >= b.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export default function Portfolio() {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [patient, setPatient] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [evolutions, setEvolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedComparisons, setSavedComparisons] = useState(0);

  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);

  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/patients", { params: { search: patientSearch, page: 1 } });
        setPatientResults(r.data?.data || r.data?.patients || []);
      } catch { setPatientResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  async function selectPatient(p) {
    setPatient(p);
    setPatientSearch(p.name);
    setPatientResults([]);
    setShowPatientDrop(false);
    setBefore(null);
    setAfter(null);
    setSavedComparisons(0);
    setLoading(true);
    try {
      const [photosRes, evoRes] = await Promise.all([
        api.get(`/photos/patient/${p.id}`),
        api.get(`/evolutions/patient/${p.id}`),
      ]);
      setPhotos([...photosRes.data].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      setEvolutions(evoRes.data || []);
    } catch {
      toast.error("Erro ao carregar fotos e histórico do paciente");
    } finally {
      setLoading(false);
    }
  }

  function clearPatient() {
    setPatient(null);
    setPatientSearch("");
    setPhotos([]);
    setEvolutions([]);
    setBefore(null);
    setAfter(null);
    setSavedComparisons(0);
  }

  function pickPhoto(photo) {
    if (before?.id === photo.id) { setBefore(null); return; }
    if (after?.id === photo.id) { setAfter(null); return; }
    if (!before) { setBefore(photo); return; }
    if (!after) { setAfter(photo); return; }
    // já tem os dois: substitui o "antes" e começa de novo
    setBefore(photo);
    setAfter(null);
  }

  function saveComparison() {
    setSavedComparisons((n) => n + 1);
    toast.success("Comparação salva");
  }

  function clearComparison() {
    setBefore(null);
    setAfter(null);
  }

  function procedureForPhoto(photo) {
    const sameDay = evolutions.find((e) => {
      const d1 = new Date(e.date || e.createdAt).toDateString();
      const d2 = new Date(photo.createdAt).toDateString();
      return d1 === d2;
    });
    return sameDay?.procedure || sameDay?.procedureRelation?.name || null;
  }

  const age = ageFromBirthDate(patient?.birthDate);

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Portfólio</h1>
          <p className="text-gray-500 mt-1 max-w-lg">
            A evolução de cada paciente contada em imagens — escolha duas fotos e a gente monta o antes e depois.
          </p>
        </div>

        {/* Combobox paciente */}
        <div className="relative w-full md:w-80 shrink-0">
          <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Paciente</label>
          <div className="flex items-center gap-2 border-[1.5px] border-verde rounded-xl px-3.5 bg-white focus-within:ring-3 focus-within:ring-verde/10">
            <Search size={16} className="text-verde shrink-0" />
            <input
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
              onFocus={() => patientSearch.length >= 2 && setShowPatientDrop(true)}
              onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
              placeholder="Buscar paciente…"
              className="flex-1 border-none bg-transparent py-3 text-sm font-semibold text-verde-900 focus:outline-none"
              autoComplete="off"
            />
            {patient && (
              <button type="button" onClick={clearPatient}
                className="text-gray-400 hover:text-red-400 transition shrink-0">
                <X size={16} />
              </button>
            )}
          </div>
          {showPatientDrop && patientResults.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-creme-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
              {patientResults.map((p) => (
                <button key={p.id} type="button" onMouseDown={() => selectPatient(p)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-creme-50 text-verde-900 font-medium">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!patient ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
            <Images size={28} className="text-ambar" />
          </div>
          <h2 className="text-xl font-semibold text-verde-900 mb-2">Selecione um paciente</h2>
          <p className="text-gray-500 max-w-xs">Busque um paciente acima para ver as fotos e montar uma comparação antes/depois.</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square bg-creme-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Faixa do paciente selecionado */}
          <Card className="bg-white! p-4.5 mb-5 flex items-center gap-3.5 flex-wrap">
            <div className="w-11 h-11 rounded-full bg-verde flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">{initials(patient.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-verde-900 truncate">{patient.name}</p>
              <p className="text-xs text-gray-400">
                {[age != null ? `${age} anos` : null, `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex gap-5">
              <div className="text-center">
                <p className="text-[17px] font-extrabold text-verde">{photos.length}</p>
                <p className="text-[10.5px] text-gray-400">fotos</p>
              </div>
              <div className="text-center">
                <p className="text-[17px] font-extrabold text-verde">{evolutions.length}</p>
                <p className="text-[10.5px] text-gray-400">evoluções</p>
              </div>
              <div className="text-center">
                <p className="text-[17px] font-extrabold text-verde">{savedComparisons}</p>
                <p className="text-[10.5px] text-gray-400">comparações</p>
              </div>
            </div>
          </Card>

          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-creme-100 rounded-2xl flex items-center justify-center mb-3">
                <Images size={22} className="text-ambar" />
              </div>
              <p className="text-sm text-gray-400">Este paciente ainda não tem fotos anexadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
              {/* GALERIA */}
              <Card className="bg-white! p-5">
                <div className="flex justify-between items-baseline mb-1.5 gap-3 flex-wrap">
                  <p className="text-[15.5px] font-bold text-verde-900">Galeria</p>
                  {(before || after) && (
                    <p className="text-xs font-semibold text-ambar-600">
                      {[before, after].filter(Boolean).length} de 2 fotos selecionadas para comparação
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">Toque em duas fotos para montar o antes e depois.</p>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo) => {
                    const isBefore = before?.id === photo.id;
                    const isAfter = after?.id === photo.id;
                    const procedure = procedureForPhoto(photo);
                    return (
                      <button
                        key={photo.id}
                        onClick={() => pickPhoto(photo)}
                        className={`group relative aspect-4/5 rounded-xl overflow-hidden bg-creme-100 border-2 transition ${
                          isBefore || isAfter ? "border-verde" : "border-creme-200 hover:border-ambar/40"
                        }`}
                      >
                        <img src={photoUrl(photo.id)} alt={photo.fileName} className="w-full h-full object-cover" loading="lazy" />
                        {(isBefore || isAfter) && (
                          <span className="absolute top-2 left-2 w-5.5 h-5.5 rounded-full bg-verde text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white">
                            {isBefore ? 1 : 2}
                          </span>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-2 py-1.5">
                          <p className="text-white text-[10px] font-semibold">
                            {new Date(photo.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                          {procedure && (
                            <span className="inline-block mt-1 bg-verde-200/25 text-verde-200 rounded px-1.5 py-0.5 text-[9px] font-bold truncate max-w-full">
                              {procedure}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* COLUNA DIREITA */}
              <div className="flex flex-col gap-4">
                {/* ANTES & DEPOIS */}
                <div className="bg-gradient-to-br from-verde-900 to-verde-950 rounded-2xl p-5 text-white">
                  <p className="text-[15px] font-bold mb-3.5">Antes &amp; depois</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className={`relative aspect-4/5 rounded-xl overflow-hidden border ${before ? "border-white/40" : "border-dashed border-white/25"}`}>
                        {before ? (
                          <img src={photoUrl(before.id)} alt="Antes" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <p className="text-[11px] text-white/40 px-2 text-center">Escolha a foto de antes</p>
                          </div>
                        )}
                      </div>
                      {before && (
                        <p className="text-[10.5px] text-white/55 mt-1.5 font-mono">
                          {new Date(before.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className={`relative aspect-4/5 rounded-xl overflow-hidden border ${after ? "border-verde-200/60" : "border-dashed border-white/25"}`}>
                        {after ? (
                          <img src={photoUrl(after.id)} alt="Depois" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <p className="text-[11px] text-white/40 px-2 text-center">Escolha a foto de depois</p>
                          </div>
                        )}
                      </div>
                      {after && (
                        <p className="text-[10.5px] text-verde-200 mt-1.5 font-mono">
                          {new Date(after.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 !bg-white !text-verde-900 !border-0"
                      disabled={!before || !after}
                      onClick={saveComparison}
                    >
                      Salvar comparação
                    </Button>
                    <button
                      onClick={clearComparison}
                      className="bg-white/10 hover:bg-white/20 transition text-white text-[12.5px] font-semibold rounded-[10px] px-3.5"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                {/* EVOLUÇÕES RECENTES */}
                <Card className="bg-white! p-4.5">
                  <p className="text-[15px] font-bold text-verde-900 mb-3">Evoluções recentes</p>
                  {evolutions.length === 0 ? (
                    <p className="text-xs text-gray-400">Nenhuma evolução registrada ainda.</p>
                  ) : (
                    <div>
                      {evolutions.slice(0, 5).map((e) => (
                        <div key={e.id} className="flex gap-3 py-2.5 border-t border-creme-200 first:border-t-0 first:pt-0">
                          <span className="w-2 h-2 rounded-full bg-verde-400 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-2">
                              <p className="text-[13px] font-bold text-verde-900 truncate">
                                {e.procedure || e.procedureRelation?.name || "Procedimento"}
                              </p>
                              <p className="text-[11px] text-gray-400 font-mono shrink-0">
                                {new Date(e.date || e.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </p>
                            </div>
                            {(e.description || e.content) && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.description || e.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
