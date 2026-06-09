import { useEffect, useRef, useState } from "react";
import { Plus, Map, Trash2, Edit2, Check, X, Printer, RotateCcw, Save, ImageIcon, User } from "lucide-react";

const PRESET_IMAGES = [
  { value: "/face-1.png",       label: "Rosto Padrão",     desc: "Vista frontal neutra" },
  { value: "/face-musculo.png", label: "Mapa Muscular",    desc: "Com referências anatômicas" },
  { value: "/face-boca.png",    label: "Foco Boca/Lábios", desc: "Detalhamento peribucal" },
];
import toast from "react-hot-toast";
import api from "../../services/api";
import FaceMap from "./FaceMap";
import Spinner from "../ui/Spinner";
import { FACIAL_MUSCLES, TAG_COLORS, TAG_LABELS, VIAL_PRESENTATIONS } from "../../data/faceMuscles";

const EMPTY_FORM = {
  productName: "",
  applicationDate: new Date().toISOString().slice(0, 10),
  dilutionDate: "",
  dilutionVolume: "",
  lotNumber: "",
  expiryDate: "",
  vialPresentation: "100U",
  clinicalNotes: "",
};

export default function ProcedureMapTab({ patientId, patientName = "", procedures = [] }) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [backgroundPhotoId, setBackgroundPhotoId] = useState(null);
  const [baseImage, setBaseImage] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedMuscleId, setSelectedMuscleId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [choosingImage, setChoosingImage] = useState(false);
  const [patientPhotos, setPatientPhotos] = useState([]);
  const printRef = useRef(null);

  async function loadMaps() {
    try {
      const res = await api.get(`/procedure-maps/patient/${patientId}`);
      setMaps(res.data);
      if (res.data.length > 0 && !selectedId) openMap(res.data[0]);
    } catch {
      toast.error("Erro ao carregar mapas");
    } finally {
      setLoading(false);
    }
  }

  function openMap(map) {
    setSelectedId(map.id);
    setMarkers(map.markers ?? []);
    setBackgroundPhotoId(map.backgroundPhotoId ?? null);
    setBaseImage(map.baseImage ?? null);
    setChoosingImage(!map.baseImage && !map.backgroundPhotoId);
    setTitleInput(map.title ?? "");
    setEditingTitle(false);
    setSelectedMuscleId(null);
    setFormData({
      productName:     map.productName     ?? "",
      applicationDate: map.applicationDate ? map.applicationDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      dilutionDate:    map.dilutionDate    ? map.dilutionDate.slice(0, 10) : "",
      dilutionVolume:  map.dilutionVolume  ?? "",
      lotNumber:       map.lotNumber       ?? "",
      expiryDate:      map.expiryDate      ? map.expiryDate.slice(0, 10) : "",
      vialPresentation: map.vialPresentation ?? "100U",
      clinicalNotes:   map.clinicalNotes   ?? "",
    });
  }

  async function createMap() {
    try {
      const res = await api.post(`/procedure-maps/patient/${patientId}`, {
        title: newTitle.trim() || null,
        markers: [],
        ...EMPTY_FORM,
      });
      setMaps((prev) => [res.data, ...prev]);
      openMap(res.data);
      setCreating(false);
      setNewTitle("");
      toast.success("Sessão criada");
    } catch {
      toast.error("Erro ao criar sessão");
    }
  }

  async function confirmBaseImage(imgValue) {
    setBaseImage(imgValue);
    setBackgroundPhotoId(null);
    setChoosingImage(false);
    try {
      await api.put(`/procedure-maps/${selectedId}`, { baseImage: imgValue, backgroundPhotoId: null });
    } catch { toast.error("Erro ao salvar imagem"); }
  }

  async function confirmPatientPhoto(photoId) {
    setBackgroundPhotoId(photoId);
    setBaseImage(null);
    setChoosingImage(false);
    try {
      await api.put(`/procedure-maps/${selectedId}`, { backgroundPhotoId: photoId, baseImage: null });
    } catch { toast.error("Erro ao salvar foto"); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/procedure-maps/${selectedId}`, {
        title: titleInput.trim() || null,
        markers,
        backgroundPhotoId,
        baseImage,
        ...formData,
        dilutionVolume: formData.dilutionVolume !== "" ? parseFloat(formData.dilutionVolume) : null,
        dilutionDate:   formData.dilutionDate   || null,
        expiryDate:     formData.expiryDate     || null,
        applicationDate: formData.applicationDate || null,
      });
      setMaps((prev) =>
        prev.map((m) => m.id === selectedId ? { ...m, ...formData, markers, backgroundPhotoId, baseImage, title: titleInput.trim() || null } : m)
      );
      toast.success("Salvo");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBgChange(photoId) {
    setBackgroundPhotoId(photoId);
    try {
      await api.put(`/procedure-maps/${selectedId}`, { backgroundPhotoId: photoId });
    } catch {
      toast.error("Erro ao salvar fundo");
    }
  }

  async function deleteMap(id) {
    if (!window.confirm("Remover esta sessão?")) return;
    try {
      await api.delete(`/procedure-maps/${id}`);
      const remaining = maps.filter((m) => m.id !== id);
      setMaps(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) openMap(remaining[0]);
        else { setSelectedId(null); setMarkers([]); }
      }
      toast.success("Sessão removida");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  useEffect(() => {
    loadMaps();
    api.get(`/photos/patient/${patientId}`).then((r) => setPatientPhotos(r.data)).catch(() => {});
  }, [patientId]);

  // ── Computed summary ──
  const summary = markers
    .filter((m) => m.muscleId)
    .reduce((acc, m) => {
      if (!acc[m.muscleId]) acc[m.muscleId] = { name: m.muscleName, tag: m.tag, color: m.color, count: 0, totalUnits: 0 };
      acc[m.muscleId].count++;
      acc[m.muscleId].totalUnits += (parseFloat(m.units) || 0);
      return acc;
    }, {});
  const totalUnits = Object.values(summary).reduce((s, x) => s + x.totalUnits, 0);
  const totalPoints = markers.filter((m) => !m.type || m.type === "point").length;

  const selectedMuscle = FACIAL_MUSCLES.find((m) => m.id === selectedMuscleId) ?? null;
  const selectedMap = maps.find((m) => m.id === selectedId);

  function handlePrint() {
    window.print();
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ── SIDEBAR: session list ── */}
      <div className="w-full lg:w-48 lg:shrink-0 no-print">
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-[#1F4D46] hover:bg-[#285A50] text-white py-2 rounded-xl text-sm font-medium transition mb-3">
          <Plus size={15} /> Nova sessão
        </button>

        {creating && (
          <div className="bg-white border border-[#D8CDB9] rounded-xl p-3 mb-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createMap(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Título (opcional)"
              className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm mb-2"
            />
            <div className="flex gap-2">
              <button onClick={createMap} className="flex-1 bg-[#1F4D46] text-white py-1.5 rounded-lg text-xs font-medium">Criar</button>
              <button onClick={() => setCreating(false)} className="flex-1 border border-[#C2A56B] py-1.5 rounded-lg text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        )}

        {maps.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Map size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Nenhuma sessão</p>
          </div>
        ) : (
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 lg:max-h-130 lg:overflow-y-auto lg:pr-1">
            {maps.map((m) => {
              const mTotal = (m.markers ?? []).filter((mk) => mk.muscleId).reduce((s, mk) => s + (parseFloat(mk.units) || 0), 0);
              return (
                <div key={m.id} onClick={() => openMap(m)}
                  className={`group relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition shrink-0 lg:shrink ${
                    m.id === selectedId
                      ? "bg-[#1F4D46] text-white"
                      : "bg-[#F5F1EA] border border-[#D8CDB9] text-[#1F4D46] hover:bg-[#E8E0D2]"
                  }`}>
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold truncate">{m.title || "Sem título"}</p>
                    <button onClick={(e) => { e.stopPropagation(); deleteMap(m.id); }}
                      className={`opacity-0 group-hover:opacity-100 shrink-0 ml-1 transition ${m.id === selectedId ? "text-white/60 hover:text-red-300" : "text-gray-300 hover:text-red-400"}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {m.productName && (
                    <p className={`text-[10px] truncate ${m.id === selectedId ? "text-white/70" : "text-gray-500"}`}>{m.productName}</p>
                  )}
                  <div className={`flex items-center gap-1.5 text-[10px] ${m.id === selectedId ? "text-white/60" : "text-gray-400"}`}>
                    <span>{new Date(m.date).toLocaleDateString("pt-BR")}</span>
                    {mTotal > 0 && <span>· {mTotal}U</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MAIN EDITOR ── */}
      {!selectedMap ? (
        <div className="flex-1 bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl p-10 text-center">
          <Map size={36} className="mx-auto mb-3 text-[#C2A56B]" />
          <p className="text-gray-500 text-sm">Crie uma nova sessão para começar a mapear pontos de aplicação</p>
        </div>
      ) : (
        <div className="flex-1 min-w-0 bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl overflow-hidden print-area">

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#D8CDB9] bg-white no-print">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">✏️</span>
              {editingTitle ? (
                <>
                  <input autoFocus value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); if (e.key === "Escape") setEditingTitle(false); }}
                    className="border border-[#C2A56B] rounded-lg px-2 py-1 text-sm font-semibold text-[#1F4D46] w-44" />
                  <button onClick={() => setEditingTitle(false)} className="text-[#1F4D46]"><Check size={14} /></button>
                  <button onClick={() => setEditingTitle(false)} className="text-gray-400"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#1F4D46] truncate">
                    {titleInput || "Mapa de Aplicação"}
                  </span>
                  <button onClick={() => setEditingTitle(true)} className="text-gray-400 hover:text-[#1F4D46]"><Edit2 size={12} /></button>
                </>
              )}
              {patientName && <span className="text-xs text-gray-400 ml-1 truncate">— {patientName}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#C2A56B] text-gray-600 hover:bg-[#E8E0D2] transition">
                <Printer size={13} /> Imprimir
              </button>
              <button onClick={() => setChoosingImage(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#C2A56B] text-gray-600 hover:bg-[#E8E0D2] transition">
                <ImageIcon size={13} /> Imagem
              </button>
              <button onClick={() => { setMarkers([]); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#C2A56B] text-gray-600 hover:bg-[#E8E0D2] transition">
                <RotateCcw size={13} /> Limpar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1F4D46] text-white hover:bg-[#285A50] disabled:opacity-60 transition">
                <Save size={13} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>

          {/* ── SELEÇÃO DE IMAGEM BASE ── */}
          {choosingImage && (
            <div className="p-6">
              <p className="text-sm font-semibold text-[#1F4D46] mb-1">Escolha a imagem base</p>
              <p className="text-xs text-gray-400 mb-5">Selecione um modelo pré-definido ou use uma foto do paciente para começar a mapear.</p>

              {/* Imagens preset + foto do paciente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PRESET_IMAGES.map((img) => (
                  <button key={img.value} onClick={() => confirmBaseImage(img.value)}
                    className="group border-2 border-[#D8CDB9] hover:border-[#1F4D46] rounded-2xl overflow-hidden transition text-left">
                    <div className="bg-[#F5F1EA] flex items-center justify-center h-44 overflow-hidden">
                      <img src={img.value} alt={img.label} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-[#1F4D46]">{img.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{img.desc}</p>
                    </div>
                  </button>
                ))}

                {/* Card: foto do paciente */}
                <div className="border-2 border-[#D8CDB9] rounded-2xl overflow-hidden">
                  <div className="bg-[#F5F1EA] h-44 overflow-y-auto p-2">
                    {patientPhotos.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <User size={28} className="mb-2 opacity-40" />
                        <p className="text-xs text-center">Nenhuma foto cadastrada para este paciente</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {patientPhotos.map((p) => {
                          const token = localStorage.getItem("token");
                          const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
                          return (
                            <button key={p.id} onClick={() => confirmPatientPhoto(p.id)}
                              className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[#1F4D46] transition">
                              <img src={`${BASE}/photos/${p.id}/file?token=${encodeURIComponent(token ?? "")}`}
                                alt="" className="w-full h-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-[#1F4D46]">Foto do Paciente</p>
                    <p className="text-xs text-gray-400 mt-0.5">Use uma foto real do paciente</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={choosingImage ? "hidden" : "p-5"}>
            {/* ── PRODUCT FORM ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Produto Utilizado *</label>
                <input
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="Ex: Botulift, Dysport, Xeomin…"
                  className="w-full border border-[#C2A56B] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F4D46]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data da Aplicação</label>
                <input type="date" value={formData.applicationDate}
                  onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                  className="w-full border border-[#C2A56B] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1F4D46]" />
              </div>
            </div>

            {/* Product data */}
            <div className="bg-white border border-[#D8CDB9] rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados do Produto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data de Diluição</label>
                  <input type="date" value={formData.dilutionDate}
                    onChange={(e) => setFormData({ ...formData, dilutionDate: e.target.value })}
                    className="w-full border border-[#C2A56B] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1F4D46]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Volume da Diluição (ml)</label>
                  <input type="number" min="0" step="0.1" value={formData.dilutionVolume}
                    onChange={(e) => setFormData({ ...formData, dilutionVolume: e.target.value })}
                    placeholder="Ex: 2"
                    className="w-full border border-[#C2A56B] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1F4D46]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Número do Lote</label>
                  <input value={formData.lotNumber}
                    onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                    placeholder="Ex: 007"
                    className="w-full border border-[#C2A56B] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1F4D46]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data de Validade</label>
                  <input type="date" value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full border border-[#C2A56B] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1F4D46]" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Apresentação do Frasco</label>
                  <select value={formData.vialPresentation}
                    onChange={(e) => setFormData({ ...formData, vialPresentation: e.target.value })}
                    className="w-full border border-[#C2A56B] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1F4D46]">
                    {VIAL_PRESENTATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── FACE + MUSCLES ── */}
            <div className="flex flex-col lg:flex-row gap-5 items-start mb-5">
              {/* Face */}
              <div className="w-full lg:shrink-0" style={{ maxWidth: 320 }}>
                <p className="text-xs text-[#C0392B] font-medium mb-2 text-center no-print">
                  {selectedMuscleId
                    ? `Músculo: ${selectedMuscle?.name} — clique no rosto para marcar`
                    : "Selecione um músculo e clique no rosto para marcar os pontos"}
                </p>
                <FaceMap
                  markers={markers}
                  onChange={setMarkers}
                  onBgChange={handleBgChange}
                  backgroundPhotoId={backgroundPhotoId}
                  baseImage={baseImage ?? "/face-1.png"}
                  procedures={procedures}
                  patientId={patientId}
                  selectedMuscle={selectedMuscle}
                  compact
                />
                <div className="mt-2 text-center text-xs text-gray-500">
                  <span className="font-semibold text-[#1F4D46]">{totalPoints} ponto{totalPoints !== 1 ? "s" : ""}</span>
                  {totalUnits > 0 && <span> · <span className="font-semibold text-[#1F4D46]">{totalUnits}U total</span></span>}
                </div>
                {totalPoints > 0 && (
                  <p className="text-center text-[10px] text-gray-400 mt-0.5">
                    Clique no rosto para adicionar · Clique no ponto para editar
                  </p>
                )}
              </div>

              {/* Muscles selector */}
              <div className="flex-1 min-w-0 no-print w-full lg:w-auto">
                <p className="text-xs font-semibold text-gray-600 mb-2">Selecione os Músculos:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1 max-h-72 lg:max-h-115 overflow-y-auto pr-1">
                  {FACIAL_MUSCLES.map((muscle) => {
                    const isSelected = selectedMuscleId === muscle.id;
                    const used = markers.filter((mk) => mk.muscleId === muscle.id);
                    const usedUnits = used.reduce((s, mk) => s + (parseFloat(mk.units) || 0), 0);

                    return (
                      <button key={muscle.id}
                        onClick={() => setSelectedMuscleId(isSelected ? null : muscle.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                          isSelected
                            ? "border-2 bg-white"
                            : "border-[#D8CDB9] bg-white hover:bg-[#F5F1EA]"
                        }`}
                        style={isSelected ? { borderColor: muscle.color } : {}}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: muscle.color }} />
                            <span className="text-sm font-semibold text-[#1F4D46] truncate">{muscle.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${TAG_COLORS[muscle.tag] ?? "bg-gray-100 text-gray-600"}`}>
                              {TAG_LABELS[muscle.tag] ?? muscle.tag}
                            </span>
                          </div>
                          {usedUnits > 0 && (
                            <span className="text-xs font-bold shrink-0" style={{ color: muscle.color }}>
                              {used.length}pt · {usedUnits}U
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 ml-4">{muscle.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── SUMMARY ── */}
            {Object.keys(summary).length > 0 && (
              <div className="bg-white border border-[#D8CDB9] rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📋 Resumo da Aplicação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
                  {Object.values(summary).map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-[#1F4D46]">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.count} ponto{s.count !== 1 ? "s" : ""}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: s.color }}>
                        {s.totalUnits}U
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-end justify-between pt-3 border-t border-[#D8CDB9]">
                  <div>
                    <p className="text-xs text-gray-400">Total de Unidades</p>
                    <p className="text-3xl font-black text-[#1F4D46]">{totalUnits}U</p>
                  </div>
                  {formData.productName && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Produto</p>
                      <p className="text-sm font-semibold text-[#1F4D46]">{formData.productName}</p>
                      {formData.vialPresentation && <p className="text-xs text-gray-400">{formData.vialPresentation}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── CLINICAL NOTES ── */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Observações Clínicas:</label>
              <textarea
                rows={3}
                value={formData.clinicalNotes}
                onChange={(e) => setFormData({ ...formData, clinicalNotes: e.target.value })}
                placeholder="Anotações sobre a aplicação, reações, recomendações pós-procedimento…"
                className="w-full border border-[#C2A56B] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1F4D46] resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
