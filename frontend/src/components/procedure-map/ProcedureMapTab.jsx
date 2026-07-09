import { useEffect, useRef, useState } from "react";
import { Plus, Map, Trash2, Edit2, Check, X, Printer, RotateCcw, Save, ImageIcon, User, ClipboardList, Pencil, Repeat, Eye, EyeOff, CalendarClock } from "lucide-react";

const PRESET_IMAGES = [
  { value: "/face-1.png",       label: "Rosto Padrão",     desc: "Vista frontal neutra" },
  { value: "/face-musculo.png", label: "Mapa Muscular",    desc: "Com referências anatômicas" },
  { value: "/face-boca.png",    label: "Foco Boca/Lábios", desc: "Detalhamento peribucal" },
  { value: "/corpo-1.png",       label: "Corpo Inteiro", desc: "Frente e costas" },
  { value: "/corpo-musculo.png", label: "Glúteos",       desc: "Músculos glúteos e quadril" },
];
import toast from "react-hot-toast";
import api from "../../services/api";
import FaceMap, { buildProductLegend, shapeForGen, GEN_SHAPE_LABEL, ShapeSwatch } from "./FaceMap";
import Spinner from "../ui/Spinner";
import SearchableSelect from "../ui/SearchableSelect";
import { FACIAL_MUSCLES, GLUTEAL_MUSCLES, TAG_COLORS, TAG_LABELS, vividColor } from "../../data/faceMuscles";

// Grupo muscular sugerido por imagem (a pessoa pode ver os músculos em
// qualquer imagem via checkbox; isto só define QUAL grupo aparece).
const GLUTEAL_IMAGES = ["/corpo-1.png", "/corpo-musculo.png"];
function muscleGroupForImage(img) {
  return GLUTEAL_IMAGES.includes(img) ? GLUTEAL_MUSCLES : FACIAL_MUSCLES;
}

// Unidades de medida disponíveis para apresentação do frasco
const VIAL_UNITS = ["U", "UI", "ml", "mg", "mcg", "%"];

const EMPTY_FORM = {
  productName: "",
  applicationDate: new Date().toISOString().slice(0, 10),
  dilutionDate: "",
  dilutionVolume: "",
  lotNumber: "",
  expiryDate: "",
  vialQuantity: "",
  vialUnit: "U",
  clinicalNotes: "",
};

export default function ProcedureMapTab({ patientId, patientName = "", procedures = [] }) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [history, setHistory] = useState([]); // pilha de estados anteriores de markers (p/ desfazer)
  const [backgroundPhotoId, setBackgroundPhotoId] = useState(null);
  const [baseImage, setBaseImage] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  // Lista de N produtos do mapa: { id, productId?, productName, lotNumber?, expiryDate?, dilutionVolume?, vialQuantity?, vialUnit? }
  const [products, setProducts] = useState([]);
  const [stockProducts, setStockProducts] = useState([]); // catálogo do estoque (opção "selecionar dos existentes")
  const [selectedMuscleId, setSelectedMuscleId] = useState(null);
  const [showMuscles, setShowMuscles] = useState(false);
  const skipAutoSave = useRef(true);
  const [autoSaved, setAutoSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [choosingImage, setChoosingImage] = useState(false);
  const [patientPhotos, setPatientPhotos] = useState([]);
  const [appointments, setAppointments] = useState([]); // agendamentos do paciente (vínculo opcional)
  const [appointmentId, setAppointmentId] = useState(""); // vínculo do mapa aberto
  const [showInherited, setShowInherited] = useState(true); // mostrar pontos da aplicação anterior
  const [creatingRetorno, setCreatingRetorno] = useState(false);
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
    skipAutoSave.current = true; // evita auto-save disparar ao carregar
    setSelectedId(map.id);
    setMarkers(map.markers ?? []);
    setHistory([]); // novo mapa: zera histórico de desfazer
    setBackgroundPhotoId(map.backgroundPhotoId ?? null);
    setBaseImage(map.baseImage ?? null);
    setChoosingImage(!map.baseImage && !map.backgroundPhotoId);
    setTitleInput(map.title ?? "");
    setEditingTitle(false);
    setSelectedMuscleId(null);
    setAppointmentId(map.appointmentId ?? "");
    setShowInherited(true);
    // Retrocompat: mapas antigos usavam vialPresentation (ex: "100U").
    // Separamos número e unidade ao carregar.
    let vialQuantity = map.vialQuantity ?? "";
    let vialUnit = map.vialUnit ?? "U";
    if (!map.vialQuantity && map.vialPresentation) {
      const match = String(map.vialPresentation).match(/^([\d.,]+)\s*(\D*)$/);
      if (match) {
        vialQuantity = match[1].replace(",", ".");
        vialUnit = match[2].trim() || "U";
      }
    }

    setFormData({
      productName:     map.productName     ?? "",
      applicationDate: map.applicationDate ? map.applicationDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      dilutionDate:    map.dilutionDate    ? map.dilutionDate.slice(0, 10) : "",
      dilutionVolume:  map.dilutionVolume  ?? "",
      lotNumber:       map.lotNumber       ?? "",
      expiryDate:      map.expiryDate      ? map.expiryDate.slice(0, 10) : "",
      vialQuantity,
      vialUnit,
      clinicalNotes:   map.clinicalNotes   ?? "",
    });

    // Lista de produtos: usa map.products se existir; senão MIGRA o produto único
    // legado (productName/lote/validade) como 1º item — nada se perde.
    let prodList = Array.isArray(map.products) ? map.products : [];
    if (prodList.length === 0 && map.productName) {
      prodList = [{
        id: crypto.randomUUID(),
        productId: null,
        productName: map.productName,
        lotNumber: map.lotNumber ?? "",
        expiryDate: map.expiryDate ? map.expiryDate.slice(0, 10) : "",
        dilutionVolume: map.dilutionVolume ?? "",
        vialQuantity,
        vialUnit,
      }];
    } else {
      prodList = prodList.map((p) => ({
        id: p.id || crypto.randomUUID(),
        productId: p.productId ?? null,
        productName: p.productName ?? "",
        lotNumber: p.lotNumber ?? "",
        expiryDate: p.expiryDate ? String(p.expiryDate).slice(0, 10) : "",
        dilutionVolume: p.dilutionVolume ?? "",
        vialQuantity: p.vialQuantity ?? "",
        vialUnit: p.vialUnit ?? "U",
      }));
    }
    setProducts(prodList);
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
      const cleanProducts = products
        .filter((p) => p.productName?.trim())
        .map((p) => ({
          id: p.id,
          productId: p.productId || null,
          productName: p.productName.trim(),
          lotNumber: p.lotNumber || null,
          expiryDate: p.expiryDate || null,
          dilutionVolume: p.dilutionVolume !== "" ? parseFloat(p.dilutionVolume) : null,
          vialQuantity: p.vialQuantity || null,
          vialUnit: p.vialUnit || null,
        }));
      await api.put(`/procedure-maps/${selectedId}`, {
        title: titleInput.trim() || null,
        markers,
        products: cleanProducts,
        backgroundPhotoId,
        baseImage,
        ...formData,
        dilutionVolume: formData.dilutionVolume !== "" ? parseFloat(formData.dilutionVolume) : null,
        dilutionDate:   formData.dilutionDate   || null,
        expiryDate:     formData.expiryDate     || null,
        applicationDate: formData.applicationDate || null,
        // productName legado = 1º produto da lista, p/ retrocompat de dados/impressão
        productName: cleanProducts[0]?.productName || formData.productName || null,
      });
      setMaps((prev) =>
        prev.map((m) => m.id === selectedId ? { ...m, ...formData, products: cleanProducts, markers, backgroundPhotoId, baseImage, title: titleInput.trim() || null } : m)
      );
      toast.success("Salvo");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  // ── Auto-save dos marcadores (pontos e traços) ──
  // Salva em segundo plano sempre que o desenho muda, para nunca perder o
  // trabalho caso a pessoa esqueça de clicar em "Salvar".
  // Libera o auto-save logo após carregar um mapa
  useEffect(() => {
    if (!selectedId) return;
    const t = setTimeout(() => { skipAutoSave.current = false; }, 100);
    return () => clearTimeout(t);
  }, [selectedId]);

  useEffect(() => {
    // não salva no carregamento inicial nem sem mapa selecionado
    if (skipAutoSave.current || !selectedId) return;
    const t = setTimeout(async () => {
      try {
        await api.put(`/procedure-maps/${selectedId}`, { markers });
        setMaps((prev) => prev.map((m) => m.id === selectedId ? { ...m, markers } : m));
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 1500);
      } catch { /* silencioso — o save manual continua disponível */ }
    }, 800);
    return () => clearTimeout(t);
  }, [markers, selectedId]);

  // Atualiza markers registrando o estado anterior na pilha de histórico,
  // permitindo desfazer a última alteração. Aceita valor ou função (updater).
  function updateMarkers(next) {
    setMarkers((prev) => {
      setHistory((h) => [...h, prev].slice(-50)); // guarda até 50 passos
      return typeof next === "function" ? next(prev) : next;
    });
  }

  function undoMarkers() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setMarkers(previous);
      return h.slice(0, -1);
    });
  }

  function clearMarkers() {
    updateMarkers([]);
  }

  // ── Produtos do mapa (N produtos) ──
  function addProduct() {
    setProducts((prev) => [...prev, {
      id: crypto.randomUUID(), productId: null, productName: "",
      lotNumber: "", expiryDate: "", dilutionVolume: "", vialQuantity: "", vialUnit: "U",
    }]);
  }
  function removeProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    // Desvincula marcadores que apontavam p/ esse produto
    updateMarkers((prev) => prev.map((m) => m.productId === id ? { ...m, productId: null } : m));
  }
  function updateProduct(id, patch) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  }
  // Ao escolher do estoque, auto-preenche nome/lote/validade do produto cadastrado.
  function selectStockProduct(id, stockId) {
    const s = stockProducts.find((p) => p.id === stockId);
    if (!s) { updateProduct(id, { productId: null }); return; }
    updateProduct(id, {
      productId: s.id,
      productName: s.name,
      lotNumber: s.lotNumber ?? "",
      expiryDate: s.expiryDate ? String(s.expiryDate).slice(0, 10) : "",
      vialUnit: s.unit || "U",
    });
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
    // Catálogo do estoque p/ o seletor de produtos (silencioso: pode não ter a feature)
    api.get("/products").then((r) => setStockProducts(r.data || [])).catch(() => setStockProducts([]));
    // Agendamentos do paciente p/ vincular o mapa ao atendimento (opcional)
    api.get(`/appointments/patient/${patientId}`).then((r) => setAppointments(r.data || [])).catch(() => setAppointments([]));
  }, [patientId]);

  // Vincula/desvincula o mapa aberto a um agendamento (persiste imediatamente).
  async function linkAppointment(apptId) {
    setAppointmentId(apptId);
    if (!selectedId) return;
    try {
      await api.put(`/procedure-maps/${selectedId}`, { appointmentId: apptId || null });
      setMaps((prev) => prev.map((m) => m.id === selectedId ? { ...m, appointmentId: apptId || null } : m));
    } catch { toast.error("Erro ao vincular atendimento"); }
  }

  // Cria um novo mapa de RETORNO replicando os pontos como referência (fantasma).
  async function createRetorno() {
    if (!selectedId) return;
    setCreatingRetorno(true);
    try {
      const res = await api.post(`/procedure-maps/${selectedId}/retorno`, {});
      setMaps((prev) => [res.data, ...prev]);
      openMap(res.data);
      toast.success("Mapa de retorno criado — marque os sobrepontos");
    } catch {
      toast.error("Erro ao criar retorno");
    } finally {
      setCreatingRetorno(false);
    }
  }

  const totalPoints = markers.filter((m) => !m.type || m.type === "point").length;

  // Total geral de unidades, agrupado por tipo (U, ml, mg…), incluindo
  // todos os marcadores com quantidade — não só os de músculo.
  const totalsByUnit = markers.reduce((acc, m) => {
    const qty = parseFloat(m.units) || 0;
    if (qty <= 0) return acc;
    const u = m.unit ?? "U";
    acc[u] = (acc[u] ?? 0) + qty;
    return acc;
  }, {});
  const totalUnitEntries = Object.entries(totalsByUnit);
  const fmtNum = (n) => (Number.isInteger(n) ? n : n.toFixed(1));

  // Legenda visual de produtos: cor + número por produto (só faz sentido com >1).
  const namedProducts = products.filter((p) => p.productName?.trim());
  const productLegend = namedProducts.length > 1 ? buildProductLegend(namedProducts) : null;
  const legendEntries = productLegend
    ? namedProducts.map((p) => ({ ...productLegend[p.id], product: p }))
    : [];

  // Legenda de atendimentos por forma: quais gerações existem no mapa atual.
  const gensPresent = [...new Set(markers
    .filter((m) => !m.type || m.type === "point")
    .map((m) => Number(m.gen) || 0))].sort((a, b) => a - b);
  const showShapeLegend = gensPresent.some((g) => g > 0); // só faz sentido com pontos herdados

  // Grupo de músculos correspondente à imagem atual (faciais ou glúteos)
  const activeMuscles = muscleGroupForImage(baseImage);
  const selectedMuscle = activeMuscles.find((m) => m.id === selectedMuscleId) ?? null;

  // Ao desligar o checkbox, limpa o músculo selecionado
  useEffect(() => {
    if (!showMuscles && selectedMuscleId) setSelectedMuscleId(null);
  }, [showMuscles, selectedMuscleId]);

  // Ao trocar de imagem: limpa a seleção e liga o checkbox automaticamente
  // se a imagem for de anatomia muscular (face-musculo / corpo-musculo).
  useEffect(() => {
    setSelectedMuscleId(null);
    const isAnatomyImage = baseImage === "/face-musculo.png" || baseImage === "/corpo-musculo.png";
    setShowMuscles(isAnatomyImage);
  }, [baseImage]);
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
          className="w-full flex items-center justify-center gap-2 bg-verde hover:bg-verde-900 text-white py-2 rounded-xl text-sm font-medium transition mb-3">
          <Plus size={15} /> Nova sessão
        </button>

        {creating && (
          <div className="bg-white border border-creme-200 rounded-xl p-3 mb-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createMap(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Título (opcional)"
              className="w-full border border-ambar rounded-lg p-2 text-sm mb-2"
            />
            <div className="flex gap-2">
              <button onClick={createMap} className="flex-1 bg-verde text-white py-1.5 rounded-lg text-xs font-medium">Criar</button>
              <button onClick={() => setCreating(false)} className="flex-1 border border-ambar py-1.5 rounded-lg text-xs text-gray-500">Cancelar</button>
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
                      ? "bg-verde text-white"
                      : "bg-creme-50 border border-creme-200 text-verde hover:bg-creme-100"
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
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono ${m.id === selectedId ? "text-white/60" : "text-gray-400"}`}>
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
        <div className="flex-1 bg-creme-50 border border-creme-200 rounded-2xl p-10 text-center">
          <Map size={36} className="mx-auto mb-3 text-ambar" />
          <p className="text-gray-500 text-sm">Crie uma nova sessão para começar a mapear pontos de aplicação</p>
        </div>
      ) : (
        <div className="flex-1 min-w-0 bg-creme-50 border border-creme-200 rounded-2xl overflow-hidden print-area">

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-creme-200 bg-white no-print">
            <div className="flex items-center gap-2 min-w-0">
              <Pencil size={15} className="text-verde shrink-0" />
              {editingTitle ? (
                <>
                  <input autoFocus value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); if (e.key === "Escape") setEditingTitle(false); }}
                    className="border border-ambar rounded-lg px-2 py-1 text-sm font-semibold text-verde w-44" />
                  <button onClick={() => setEditingTitle(false)} className="text-verde"><Check size={14} /></button>
                  <button onClick={() => setEditingTitle(false)} className="text-gray-400"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-verde truncate">
                    {titleInput || "Mapa de Aplicação"}
                  </span>
                  <button onClick={() => setEditingTitle(true)} className="text-gray-400 hover:text-verde"><Edit2 size={12} /></button>
                </>
              )}
              {patientName && <span className="text-xs text-gray-400 ml-1 truncate">— {patientName}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-ambar text-gray-600 hover:bg-creme-100 transition">
                <Printer size={13} /> Imprimir
              </button>
              <button onClick={() => setChoosingImage(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-ambar text-gray-600 hover:bg-creme-100 transition">
                <ImageIcon size={13} /> Imagem
              </button>
              <button onClick={createRetorno} disabled={creatingRetorno || !selectedId}
                title="Cria um novo mapa replicando estes pontos como referência, para marcar sobrepontos no retorno"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-verde text-verde hover:bg-verde-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Repeat size={13} /> {creatingRetorno ? "Criando…" : "Novo retorno"}
              </button>
              <button onClick={undoMarkers} disabled={history.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-ambar text-gray-600 hover:bg-creme-100 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <RotateCcw size={13} /> Desfazer
              </button>
              <button onClick={clearMarkers} disabled={markers.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-erro/40 text-erro hover:bg-erro/10 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 size={13} /> Limpar
              </button>
              {autoSaved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Check size={13} /> Salvo automaticamente
                </span>
              )}
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-verde text-white hover:bg-verde-900 disabled:opacity-60 transition">
                <Save size={13} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>

          {/* ── SELEÇÃO DE IMAGEM BASE ── */}
          {choosingImage && (
            <div className="p-6">
              <p className="text-sm font-semibold text-verde mb-1">Escolha a imagem base</p>
              <p className="text-xs text-gray-400 mb-5">Selecione um modelo pré-definido ou use uma foto do paciente para começar a mapear.</p>

              {/* Imagens preset + foto do paciente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PRESET_IMAGES.map((img) => (
                  <button key={img.value} onClick={() => confirmBaseImage(img.value)}
                    className="group border-2 border-creme-200 hover:border-verde rounded-2xl overflow-hidden transition text-left">
                    <div className="bg-creme-50 flex items-center justify-center h-44 overflow-hidden">
                      <img src={img.value} alt={img.label} className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-verde">{img.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{img.desc}</p>
                    </div>
                  </button>
                ))}

                {/* Card: foto do paciente */}
                <div className="border-2 border-creme-200 rounded-2xl overflow-hidden">
                  <div className="bg-creme-50 h-44 overflow-y-auto p-2">
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
                              className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-verde transition">
                              <img src={`${BASE}/photos/${p.id}/file?token=${encodeURIComponent(token ?? "")}`}
                                alt="" className="w-full h-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-verde">Foto do Paciente</p>
                    <p className="text-xs text-gray-400 mt-0.5">Use uma foto real do paciente</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={choosingImage ? "hidden" : "p-5"}>
            {/* ── DATA DA APLICAÇÃO + VÍNCULO COM ATENDIMENTO ── */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data da Aplicação</label>
                <input type="date" value={formData.applicationDate}
                  onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                  className="w-full sm:w-64 border border-ambar rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde" />
              </div>
              <div className="min-w-55">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <CalendarClock size={12} /> Vincular ao atendimento (opcional)
                </label>
                <SearchableSelect
                  value={appointmentId}
                  onChange={linkAppointment}
                  placeholder="— sem vínculo —"
                  options={appointments.map((a) => ({
                    value: a.id,
                    label: `${new Date(a.startsAt).toLocaleDateString("pt-BR")} · ${a.title || a.procedureType || "Atendimento"}`,
                  }))}
                />
              </div>
            </div>

            {/* Toggle: mostrar/ocultar pontos da aplicação anterior (retorno) */}
            {markers.some((m) => m.inherited) && (
              <button type="button" onClick={() => setShowInherited((v) => !v)}
                className="no-print mb-4 flex items-center gap-1.5 text-xs font-medium text-verde border border-verde rounded-lg px-3 py-1.5 hover:bg-verde-50 transition">
                {showInherited ? <EyeOff size={13} /> : <Eye size={13} />}
                {showInherited ? "Ocultar aplicação anterior" : "Mostrar aplicação anterior"}
              </button>
            )}

            {/* ── PRODUTOS UTILIZADOS (N produtos) ── */}
            <div className="bg-white border border-creme-200 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produtos utilizados</p>
                <button type="button" onClick={addProduct}
                  className="text-xs font-medium text-verde border border-ambar rounded-lg px-2.5 py-1.5 hover:bg-creme-50 transition flex items-center gap-1">
                  <Plus size={12} /> Adicionar produto
                </button>
              </div>

              {products.length === 0 && (
                <p className="text-xs text-gray-400">Nenhum produto. Adicione um produto usado neste mapa.</p>
              )}

              <div className="space-y-3">
                {products.map((p, idx) => (
                  <div key={p.id} className="border border-creme-200 rounded-xl p-3 bg-creme-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-verde">Produto {idx + 1}</span>
                      <button type="button" onClick={() => removeProduct(p.id)}
                        className="text-gray-400 hover:text-red-500 transition" title="Remover produto">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Selecionar do estoque (opcional) */}
                      {stockProducts.length > 0 && (
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-gray-500 mb-1 block">Selecionar do estoque (opcional)</label>
                          <SearchableSelect
                            value={p.productId || ""}
                            onChange={(v) => selectStockProduct(p.id, v)}
                            placeholder="— digitar manualmente —"
                            options={stockProducts.map((s) => ({
                              value: s.id,
                              label: `${s.name}${s.lotNumber ? ` (lote ${s.lotNumber})` : ""}`,
                            }))}
                          />
                        </div>
                      )}
                      {/* Nome (campo aberto — sempre editável) */}
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-gray-500 mb-1 block">Produto *</label>
                        <input value={p.productName}
                          onChange={(e) => updateProduct(p.id, { productName: e.target.value, productId: null })}
                          placeholder="Ex: Botulift, Dysport, Xeomin…"
                          className="w-full border border-ambar rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-verde" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Número do Lote</label>
                        <input value={p.lotNumber}
                          onChange={(e) => updateProduct(p.id, { lotNumber: e.target.value })}
                          placeholder="Ex: 007"
                          className="w-full border border-ambar rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-verde" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Data de Validade</label>
                        <input type="date" value={p.expiryDate}
                          onChange={(e) => updateProduct(p.id, { expiryDate: e.target.value })}
                          className="w-full border border-ambar rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-verde" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Volume da Diluição (ml)</label>
                        <input type="number" min="0" step="0.1" value={p.dilutionVolume}
                          onChange={(e) => updateProduct(p.id, { dilutionVolume: e.target.value })}
                          placeholder="Ex: 2"
                          className="w-full border border-ambar rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-verde" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Apresentação do Frasco</label>
                        <div className="flex gap-2">
                          <input type="number" min="0" step="any" value={p.vialQuantity}
                            onChange={(e) => updateProduct(p.id, { vialQuantity: e.target.value })}
                            placeholder="Qtd."
                            className="flex-1 min-w-0 border border-ambar rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-verde" />
                          <select value={p.vialUnit}
                            onChange={(e) => updateProduct(p.id, { vialUnit: e.target.value })}
                            className="w-16 shrink-0 border border-ambar rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-verde">
                            {VIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Checkbox: mostrar músculos ── */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none no-print w-fit">
              <input
                type="checkbox"
                checked={showMuscles}
                onChange={(e) => setShowMuscles(e.target.checked)}
                className="w-4 h-4 accent-verde"
              />
              <span className="text-sm font-medium text-verde">Mostrar referência muscular</span>
              <span className="text-xs text-gray-400">
                ({activeMuscles === GLUTEAL_MUSCLES ? "glúteos" : "face"})
              </span>
            </label>

            {/* ── FACE + MUSCLES ── */}
            <div className="flex flex-col lg:flex-row gap-5 items-start mb-5">
              {/* Face — expande quando o seletor está fechado */}
              <div className={`w-full ${showMuscles ? "lg:shrink-0" : "flex flex-col items-center"}`}
                style={{ maxWidth: showMuscles ? 320 : 480, marginInline: showMuscles ? undefined : "auto" }}>
                <p className="text-xs text-[#C0392B] font-medium mb-2 text-center no-print">
                  {showMuscles
                    ? (selectedMuscleId
                        ? `Músculo: ${selectedMuscle?.name} — clique para marcar`
                        : "Selecione um músculo e clique na imagem para marcar")
                    : "Clique na imagem para marcar os pontos de aplicação"}
                </p>
                <div className="w-full" style={{ maxWidth: showMuscles ? 320 : 480 }}>
                  <FaceMap
                    markers={markers}
                    onChange={updateMarkers}
                    onBgChange={handleBgChange}
                    backgroundPhotoId={backgroundPhotoId}
                    baseImage={baseImage ?? "/face-1.png"}
                    procedures={procedures}
                    patientId={patientId}
                    selectedMuscle={selectedMuscle}
                    productLegend={productLegend}
                    showInherited={showInherited}
                    compact
                  />

                  {/* LEGENDA DE ATENDIMENTOS — forma por geração (na tela e na impressão) */}
                  {showShapeLegend && (
                    <div className="mt-3 border border-creme-200 rounded-xl p-3 bg-creme-50/50">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Atendimentos</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {gensPresent.map((g) => {
                          const shape = shapeForGen(g);
                          return (
                            <div key={g} className="flex items-center gap-1.5 text-xs">
                              <ShapeSwatch shape={shape} color={g === 0 ? "#00704A" : "#7A7A7A"} size={14} />
                              <span className={g === 0 ? "font-semibold text-verde" : "text-gray-500"}>
                                {GEN_SHAPE_LABEL[shape]}{g > 1 ? ` (${g})` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* LEGENDA DE PRODUTOS — cor + número por produto (na tela e na impressão) */}
                  {legendEntries.length > 0 && (
                    <div className="mt-3 border border-creme-200 rounded-xl p-3 bg-creme-50/50">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Legenda de produtos</p>
                      <div className="flex flex-col gap-1.5">
                        {legendEntries.map((e) => (
                          <div key={e.product.id} className="flex items-center gap-2 text-xs">
                            <span className="w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: e.color, fontSize: 9 }}>{e.index}</span>
                            <span className="font-semibold text-verde">{e.product.productName}</span>
                            {e.product.lotNumber && <span className="text-gray-400">· lote {e.product.lotNumber}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 text-center text-xs text-gray-500">
                    <span className="font-semibold text-verde">{totalPoints} ponto{totalPoints !== 1 ? "s" : ""}</span>
                    {totalUnitEntries.map(([unit, total]) => (
                      <span key={unit}> · <span className="font-semibold text-verde">{fmtNum(total)}{unit} total</span></span>
                    ))}
                  </div>
                  {totalPoints > 0 && (
                    <p className="text-center text-[10px] text-gray-400 mt-0.5">
                      Clique na imagem para adicionar · Clique no ponto para editar
                    </p>
                  )}
                </div>
              </div>

              {/* Muscles selector — só quando o checkbox está ligado */}
              {showMuscles && (
              <div className="flex-1 min-w-0 no-print w-full lg:w-auto">
                <p className="text-xs font-semibold text-gray-600 mb-2">Selecione os Músculos:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1 max-h-72 lg:max-h-115 overflow-y-auto pr-1">
                  {activeMuscles.map((muscle) => {
                    const isSelected = selectedMuscleId === muscle.id;
                    const used = markers.filter((mk) => mk.muscleId === muscle.id);
                    const usedUnits = used.reduce((s, mk) => s + (parseFloat(mk.units) || 0), 0);

                    return (
                      <button key={muscle.id}
                        onClick={() => setSelectedMuscleId(isSelected ? null : muscle.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                          isSelected
                            ? "border-2 bg-white"
                            : "border-creme-200 bg-white hover:bg-creme-50"
                        }`}
                        style={isSelected ? { borderColor: muscle.color } : {}}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: muscle.color }} />
                            <span className="text-sm font-semibold text-verde truncate">{muscle.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${TAG_COLORS[muscle.tag] ?? "bg-gray-100 text-gray-600"}`}>
                              {TAG_LABELS[muscle.tag] ?? muscle.tag}
                            </span>
                          </div>
                          {usedUnits > 0 && (
                            <span className="text-xs font-bold font-mono shrink-0" style={{ color: muscle.color }}>
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
              )}
            </div>

            {/* ── SUMMARY ── */}
            {markers.length > 0 && (
              <div className="bg-white border border-creme-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><ClipboardList size={13} /> Resumo da Aplicação</p>

                {/* Lista detalhada — cada marcador com tipo, nome, quantidade e unidade */}
                <div className="space-y-1 mb-3">
                  {markers.map((m, i) => {
                    const isLine = m.type === "line";
                    const name = m.procedure || m.muscleName || m.label || (isLine ? `Traço ${i + 1}` : `Ponto ${i + 1}`);
                    const qty = parseFloat(m.units) || 0;
                    const color = vividColor(m.color);
                    return (
                      <div key={m.id ?? i} className="py-1 border-b border-creme-100 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* ícone tipo: traço ou ponto */}
                            {isLine
                              ? <div className="w-4 h-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              : <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            }
                            <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0"
                              style={{ color }}>
                              {isLine ? "Traço" : "Ponto"}
                            </span>
                            <span className="text-sm text-verde truncate">{name}</span>
                          </div>
                          {qty > 0 && (
                            <span className="text-xs font-bold font-mono shrink-0 px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
                              {fmtNum(qty)}{m.unit ?? "U"}
                            </span>
                          )}
                        </div>
                        {/* Qual produto foi aplicado neste ponto (quando há +de 1 produto) */}
                        {products.length > 1 && (
                          <div className="flex items-center gap-1.5 mt-1 pl-6 no-print">
                            <span className="text-[10px] text-gray-400">produto:</span>
                            <select
                              value={m.productId || ""}
                              onChange={(e) => {
                                const pid = e.target.value || null;
                                updateMarkers((prev) => prev.map((mk) => (mk.id ?? "") === (m.id ?? "") ? { ...mk, productId: pid } : mk));
                              }}
                              className="text-[11px] border border-creme-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:border-verde max-w-[180px]"
                            >
                              <option value="">—</option>
                              {products.filter((p) => p.productName?.trim()).map((p) => (
                                <option key={p.id} value={p.id}>{p.productName}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {/* Impressão: mostra o produto escolhido em texto */}
                        {m.productId && (
                          <p className="hidden print:block text-[10px] text-gray-500 pl-6">
                            Produto: {products.find((p) => p.id === m.productId)?.productName || "—"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Contagem de pontos x traços */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 pb-3 border-b border-creme-200">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    {markers.filter((m) => !m.type || m.type === "point").length} ponto(s)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-4 h-1 rounded-full bg-gray-400" />
                    {markers.filter((m) => m.type === "line").length} traço(s)
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400">Total Aplicado</p>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      {totalUnitEntries.length > 0 ? totalUnitEntries.map(([unit, total]) => (
                        <p key={unit} className="text-3xl font-black font-mono text-verde">{fmtNum(total)}<span className="text-lg">{unit}</span></p>
                      )) : <p className="text-3xl font-black font-mono text-verde">0</p>}
                    </div>
                  </div>
                  {products.filter((p) => p.productName?.trim()).length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{products.length > 1 ? "Produtos" : "Produto"}</p>
                      {products.filter((p) => p.productName?.trim()).map((p) => (
                        <p key={p.id} className="text-sm font-semibold text-verde">
                          {p.productName}
                          {p.vialQuantity && <span className="text-xs font-normal text-gray-400"> · {p.vialQuantity}{p.vialUnit}</span>}
                        </p>
                      ))}
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
                className="w-full border border-ambar rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-verde resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
