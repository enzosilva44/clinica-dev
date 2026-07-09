import { useEffect, useState } from "react";
import { Images, X, Search, Star, Trash2, Plus, LayoutGrid, Pencil } from "lucide-react";
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

// Modal de confirmação (padrão do app, substitui o confirm() nativo).
function ConfirmModal({ title, message, confirmLabel = "Excluir", loading, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-verde-900 mb-1.5">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-sm text-gray-600 px-4 py-2 rounded-xl hover:bg-creme-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "Excluindo…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  // "showcase" = vitrine dos cases salvos | "create" = montar um case novo
  const [view, setView] = useState("showcase");

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Portfólio</h1>
          <p className="text-gray-500 mt-1 max-w-lg">
            {view === "showcase"
              ? "Sua vitrine de cases de sucesso — resultados de antes e depois dos pacientes."
              : "Escolha duas fotos de um paciente e a gente monta o antes e depois."}
          </p>
        </div>

        {/* Alternância de visão */}
        <div className="flex gap-1 bg-creme-50 border border-creme-200 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setView("showcase")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              view === "showcase" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"
            }`}
          >
            <LayoutGrid size={15} /> Vitrine
          </button>
          <button
            onClick={() => setView("create")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              view === "create" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"
            }`}
          >
            <Plus size={15} /> Criar case
          </button>
        </div>
      </div>

      {view === "showcase" ? (
        <Showcase onCreateNew={() => setView("create")} />
      ) : (
        <CreateCase onSaved={() => setView("showcase")} />
      )}
    </MainLayout>
  );
}

/* ── Modal de metadados do case (reutilizado por criar e editar) ── */
function CaseMetaModal({ heading, submitLabel, beforeId, afterId, initial, saving, allowDevicePhoto, onClose, onSubmit }) {
  const [meta, setMeta] = useState({
    title: initial?.title || "",
    procedureName: initial?.procedureName || "",
    caption: initial?.caption || "",
    featured: initial?.featured || false,
  });
  const [deviceFile, setDeviceFile] = useState(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-verde-900">{heading}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* preview */}
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          <div className="relative aspect-4/5 rounded-lg overflow-hidden bg-creme-100">
            <img src={photoUrl(beforeId)} alt="Antes" className="w-full h-full object-cover" />
            <span className="absolute top-1.5 left-1.5 bg-black/55 text-white text-[9px] font-bold rounded px-1.5 py-0.5">ANTES</span>
          </div>
          <div className="relative aspect-4/5 rounded-lg overflow-hidden bg-creme-100">
            <img src={photoUrl(afterId)} alt="Depois" className="w-full h-full object-cover" />
            <span className="absolute top-1.5 right-1.5 bg-verde text-white text-[9px] font-bold rounded px-1.5 py-0.5">DEPOIS</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Título</label>
            <input
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="Ex: Preenchimento labial"
              className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
            <input
              value={meta.procedureName}
              onChange={(e) => setMeta((m) => ({ ...m, procedureName: e.target.value }))}
              placeholder="Ex: Botox, Preenchimento…"
              className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Legenda / descrição</label>
            <textarea
              value={meta.caption}
              onChange={(e) => setMeta((m) => ({ ...m, caption: e.target.value }))}
              placeholder="Conte o resultado: nº de sessões, tempo, observações…"
              rows={3}
              className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
          </div>
          {/* Foto do dispositivo/aparelho usado — fica salva nas fotos do paciente. */}
          {allowDevicePhoto && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Foto do dispositivo <span className="text-gray-300">(opcional)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setDeviceFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-creme-100 file:text-verde hover:file:bg-creme-200 transition"
              />
              {deviceFile && (
                <p className="text-[11px] text-verde mt-1 truncate">Selecionada: {deviceFile.name}</p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={meta.featured}
              onChange={(e) => setMeta((m) => ({ ...m, featured: e.target.checked }))}
              className="w-4 h-4 accent-verde"
            />
            <span className="text-sm text-verde-900 flex items-center gap-1.5">
              <Star size={15} className="text-ambar" /> Destacar na vitrine
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-creme-50 transition">
            Cancelar
          </button>
          <Button size="sm" onClick={() => onSubmit({ ...meta, deviceFile })} disabled={saving}>
            {saving ? "Salvando…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── VITRINE ─────────────────────────── */

function Showcase({ onCreateNew }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // case sendo editado
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(null); // case aguardando confirmação de exclusão
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/portfolio");
      setCases(res.data || []);
    } catch {
      toast.error("Erro ao carregar a vitrine");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleFeatured(c) {
    try {
      await api.put(`/portfolio/${c.id}`, { featured: !c.featured });
      setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, featured: !x.featured } : x)));
    } catch {
      toast.error("Erro ao atualizar destaque");
    }
  }

  async function confirmRemove() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await api.delete(`/portfolio/${deleting.id}`);
      setCases((prev) => prev.filter((x) => x.id !== deleting.id));
      toast.success("Case removido");
      setDeleting(null);
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setRemoving(false);
    }
  }

  async function saveEdit(meta) {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/portfolio/${editing.id}`, meta);
      setCases((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...res.data } : x)));
      toast.success("Case atualizado");
      setEditing(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao atualizar");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-creme-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
          <Images size={28} className="text-ambar" />
        </div>
        <h2 className="text-xl font-semibold text-verde-900 mb-2">Sua vitrine está vazia</h2>
        <p className="text-gray-500 max-w-xs mb-6">Monte seu primeiro case de antes e depois a partir das fotos de um paciente.</p>
        <Button onClick={onCreateNew}><Plus size={16} /> Criar primeiro case</Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cases.map((c) => (
        <Card key={c.id} className="bg-white! p-0 overflow-hidden group">
          <div className="grid grid-cols-2 gap-0.5 bg-creme-200 relative">
            <div className="relative aspect-4/5 bg-creme-100">
              <img src={photoUrl(c.beforePhotoId)} alt="Antes" className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute top-2 left-2 bg-black/55 text-white text-[10px] font-bold rounded px-1.5 py-0.5">ANTES</span>
            </div>
            <div className="relative aspect-4/5 bg-creme-100">
              <img src={photoUrl(c.afterPhotoId)} alt="Depois" className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute top-2 right-2 bg-verde text-white text-[10px] font-bold rounded px-1.5 py-0.5">DEPOIS</span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-verde-900 truncate">
                  {c.title || c.procedureName || "Case de sucesso"}
                </p>
                {/* Nome do paciente removido da exibição da vitrine (privacidade). */}
                {c.title && c.procedureName && (
                  <p className="text-xs text-gray-400 truncate">{c.procedureName}</p>
                )}
              </div>
              <button
                onClick={() => toggleFeatured(c)}
                className={`shrink-0 transition ${c.featured ? "text-ambar" : "text-gray-300 hover:text-ambar"}`}
                title={c.featured ? "Remover destaque" : "Destacar"}
              >
                <Star size={18} fill={c.featured ? "currentColor" : "none"} />
              </button>
            </div>
            {c.procedureName && c.title && (
              <span className="inline-block mt-2 bg-verde-50 text-verde rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {c.procedureName}
              </span>
            )}
            {c.caption && <p className="text-xs text-gray-500 mt-2 line-clamp-3">{c.caption}</p>}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-creme-200">
              <span className="text-[11px] text-gray-400">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => setEditing(c)}
                  className="text-gray-300 hover:text-verde transition p-1"
                  title="Editar case"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleting(c)}
                  className="text-gray-300 hover:text-red-500 transition p-1"
                  title="Remover case"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}
      </div>

      {editing && (
        <CaseMetaModal
          heading="Editar case"
          submitLabel="Salvar alterações"
          beforeId={editing.beforePhotoId}
          afterId={editing.afterPhotoId}
          initial={editing}
          saving={savingEdit}
          onClose={() => setEditing(null)}
          onSubmit={saveEdit}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Excluir este case?"
          message="O case será removido da vitrine. As fotos do paciente não são apagadas."
          confirmLabel="Excluir case"
          loading={removing}
          onConfirm={confirmRemove}
          onClose={() => !removing && setDeleting(null)}
        />
      )}
    </>
  );
}

/* ─────────────────────────── CRIAR CASE ─────────────────────────── */

function CreateCase({ onSaved }) {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [patient, setPatient] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [evolutions, setEvolutions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);

  // modal de metadados ao salvar
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // procedimento sugerido a partir da foto "depois" (pré-preenche o modal)
  const suggestedProcedure = after ? procedureForPhoto(after) : null;

  async function saveCase(meta) {
    if (!before || !after || !patient) return;
    setSaving(true);
    try {
      // Se anexou foto do dispositivo, sobe primeiro (fica salva nas fotos do
      // paciente, marcada como "device") e vincula o id ao case.
      let devicePhotoId = null;
      if (meta.deviceFile) {
        const fd = new FormData();
        fd.append("photos", meta.deviceFile);
        fd.append("category", "device");
        const up = await api.post(`/photos/patient/${patient.id}`, fd);
        devicePhotoId = up.data?.[0]?.id ?? null;
      }
      await api.post("/portfolio", {
        patientId: patient.id,
        beforePhotoId: before.id,
        afterPhotoId: after.id,
        devicePhotoId,
        title: meta.title,
        procedureName: meta.procedureName,
        caption: meta.caption,
        featured: meta.featured,
      });
      toast.success("Case salvo na vitrine!");
      setShowSaveModal(false);
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao salvar o case");
    } finally {
      setSaving(false);
    }
  }

  const age = ageFromBirthDate(patient?.birthDate);

  return (
    <>
      {/* Combobox paciente */}
      <div className="relative w-full md:w-80 mb-6">
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
            <button type="button" onClick={clearPatient} className="text-gray-400 hover:text-red-400 transition shrink-0">
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
                    onClick={() => setShowSaveModal(true)}
                  >
                    Salvar na vitrine
                  </Button>
                  <button
                    onClick={() => { setBefore(null); setAfter(null); }}
                    className="bg-white/10 hover:bg-white/20 transition text-white text-[12.5px] font-semibold rounded-[10px] px-3.5"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DE METADADOS (criar) */}
      {showSaveModal && before && after && (
        <CaseMetaModal
          heading="Salvar case na vitrine"
          submitLabel="Salvar case"
          beforeId={before.id}
          afterId={after.id}
          initial={{ procedureName: suggestedProcedure || "" }}
          saving={saving}
          allowDevicePhoto
          onClose={() => setShowSaveModal(false)}
          onSubmit={saveCase}
        />
      )}
    </>
  );
}
