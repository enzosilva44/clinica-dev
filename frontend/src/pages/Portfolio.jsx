import { useEffect, useState } from "react";
import { Images, X, ArrowLeftRight, Stethoscope } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function photoUrl(id) {
  const token = localStorage.getItem("token");
  return `${API_BASE}/photos/${id}/file?token=${encodeURIComponent(token ?? "")}`;
}

export default function Portfolio() {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [patient, setPatient] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [evolutions, setEvolutions] = useState([]);
  const [loading, setLoading] = useState(false);

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

  function procedureForPhoto(photo) {
    const sameDay = evolutions.find((e) => {
      const d1 = new Date(e.date || e.createdAt).toDateString();
      const d2 = new Date(photo.createdAt).toDateString();
      return d1 === d2;
    });
    return sameDay?.procedure || sameDay?.procedureRelation?.name || null;
  }

  return (
    <MainLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-verde">Portfólio</h1>
          <p className="text-gray-500 mt-1">Monte comparações de antes/depois a partir das fotos do paciente</p>
        </div>
      </div>

      {/* Combobox paciente */}
      <div className="relative max-w-md mb-6">
        <label className="text-xs text-gray-500 mb-1 block">Paciente</label>
        <div className="flex gap-2">
          <input
            value={patientSearch}
            onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
            onFocus={() => patientSearch.length >= 2 && setShowPatientDrop(true)}
            onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
            placeholder="Buscar paciente..."
            className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
            autoComplete="off"
          />
          {patient && (
            <button type="button" onClick={clearPatient}
              className="border border-ambar rounded-xl px-3 text-gray-400 hover:text-red-400 hover:border-red-300 transition">
              <X size={16} />
            </button>
          )}
        </div>
        {showPatientDrop && patientResults.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-creme-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
            {patientResults.map((p) => (
              <button key={p.id} type="button" onClick={() => selectPatient(p)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-creme-50 text-verde">
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!patient ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
            <Images size={28} className="text-ambar" />
          </div>
          <h2 className="text-xl font-semibold text-verde mb-2">Selecione um paciente</h2>
          <p className="text-gray-500 max-w-xs">Busque um paciente acima para ver as fotos e montar uma comparação antes/depois.</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square bg-creme-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Comparação selecionada */}
          {(before || after) && (
            <div className="bg-creme-50 border border-creme-200 rounded-2xl p-5 mb-6">
              <p className="text-sm font-bold text-verde mb-3 flex items-center gap-2">
                <ArrowLeftRight size={15} /> Comparação
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">ANTES</p>
                  {before ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-creme-100">
                      <img src={photoUrl(before.id)} alt="Antes" className="w-full h-full object-cover" />
                      <button onClick={() => setBefore(null)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center">
                        <X size={13} className="text-red-400" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-white text-[10px]">{new Date(before.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square rounded-xl border-2 border-dashed border-ambar flex items-center justify-center text-xs text-gray-400">
                      Clique numa foto abaixo
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">DEPOIS</p>
                  {after ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-creme-100">
                      <img src={photoUrl(after.id)} alt="Depois" className="w-full h-full object-cover" />
                      <button onClick={() => setAfter(null)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center">
                        <X size={13} className="text-red-400" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-white text-[10px]">{new Date(after.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square rounded-xl border-2 border-dashed border-ambar flex items-center justify-center text-xs text-gray-400">
                      Clique numa foto abaixo
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Galeria de fotos do paciente */}
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-creme-100 rounded-2xl flex items-center justify-center mb-3">
                <Images size={22} className="text-ambar" />
              </div>
              <p className="text-sm text-gray-400">Este paciente ainda não tem fotos anexadas.</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold text-verde mb-3">Fotos do paciente</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {photos.map((photo) => {
                  const isBefore = before?.id === photo.id;
                  const isAfter = after?.id === photo.id;
                  const procedure = procedureForPhoto(photo);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => pickPhoto(photo)}
                      className={`group relative aspect-square rounded-xl overflow-hidden bg-creme-100 border-2 transition ${
                        isBefore ? "border-amber-500" : isAfter ? "border-verde" : "border-transparent hover:border-ambar"
                      }`}
                    >
                      <img src={photoUrl(photo.id)} alt={photo.fileName} className="w-full h-full object-cover" loading="lazy" />
                      {(isBefore || isAfter) && (
                        <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${isBefore ? "bg-amber-500" : "bg-verde"}`}>
                          {isBefore ? "Antes" : "Depois"}
                        </span>
                      )}
                      {procedure && (
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent px-1.5 py-1 flex items-center gap-1">
                          <Stethoscope size={9} className="text-white shrink-0" />
                          <p className="text-white text-[9px] truncate">{procedure}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
