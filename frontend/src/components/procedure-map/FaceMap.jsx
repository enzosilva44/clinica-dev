import { useRef, useState, useEffect } from "react";
import { X, Trash2, Dot, Minus, ImageIcon } from "lucide-react";
import api from "../../services/api";
import { vividColor } from "../../data/faceMuscles";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const SVG_W = 320;
const SVG_H = 460;

// Proporção (altura/largura) conhecida de imagens preset, para ajustar o
// viewBox e evitar que a imagem seja cortada (ex: boca aparecer completa).
// Imagens não listadas têm a proporção detectada automaticamente ao carregar.
const IMAGE_RATIOS = {
  "/face-1.png":        1122 / 1402, // ≈ 0.80
  "/face-musculo.png":  2245 / 1587, // ≈ 1.41
  "/face-boca.png":     1091 / 1442, // ≈ 0.76 (larga e baixa)
  "/corpo-1.png":       1086 / 1448, // ≈ 0.75 (corpo inteiro)
  "/corpo-musculo.png": 1122 / 1402, // ≈ 0.80 (glúteos)
};

const MARKER_COLORS = [
  { label: "Verde",    value: "#00E676" }, // verde neon
  { label: "Roxo",     value: "#B026FF" }, // roxo elétrico
  { label: "Azul",     value: "#00B0FF" }, // azul ciano vivo
  { label: "Rosa",     value: "#FF2D95" }, // magenta/pink fluorescente
  { label: "Laranja",  value: "#FF6D00" }, // laranja intenso
  { label: "Vermelho", value: "#FF1744" }, // vermelho vibrante
];

function photoUrl(id) {
  const token = localStorage.getItem("token");
  return `${API_BASE}/photos/${id}/file?token=${encodeURIComponent(token ?? "")}`;
}

export default function FaceMap({
  markers = [],
  onChange,
  onBgChange,
  backgroundPhotoId = null,
  baseImage = "/face-1.png",
  readOnly = false,
  procedures = [],
  patientId,
  selectedMuscle = null,
  compact = false,
}) {
  const svgRef = useRef(null);

  // Proporção detectada automaticamente para imagens não listadas em IMAGE_RATIOS.
  const [autoRatio, setAutoRatio] = useState(null);

  useEffect(() => {
    if (backgroundPhotoId || !baseImage || IMAGE_RATIOS[baseImage]) {
      setAutoRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) setAutoRatio(img.naturalHeight / img.naturalWidth);
    };
    img.src = baseImage;
  }, [baseImage, backgroundPhotoId]);

  // Altura do viewBox ajustada à proporção da imagem preset selecionada,
  // garantindo que a imagem apareça inteira (sem cortes) — ex: boca completa.
  const presetRatio = IMAGE_RATIOS[baseImage] ?? autoRatio;
  const svgH = !backgroundPhotoId && presetRatio
    ? Math.round(SVG_W * presetRatio)
    : SVG_H;

  const [tool, setTool] = useState("point");
  const [pendingMarker, setPendingMarker] = useState(null);
  const [pendingUnits, setPendingUnits] = useState("");
  const [pendingUnit, setPendingUnit] = useState("U");
  const [form, setForm] = useState({ procedure: "", dose: "", notes: "", color: "#1F4D46", unit: "U" });
  const [hoveredId, setHoveredId] = useState(null);
  const [linePoints, setLinePoints] = useState([]);
  const [lineForm, setLineForm] = useState({ label: "", notes: "", color: "#1F4D46", units: "", unit: "U" });
  const [mousePos, setMousePos] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") { setLinePoints([]); setPendingMarker(null); setShowPhotoPicker(false); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    api.get(`/photos/patient/${patientId}`).then((r) => setPhotos(r.data)).catch(() => {});
  }, [patientId]);

  function getSvgCoords(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * (SVG_W / rect.width)),
      y: Math.round((e.clientY - rect.top) * (svgH / rect.height)),
    };
  }

  function isInsideFace(x, y) {
    if (backgroundPhotoId || baseImage) return true;
    return ((x - 160) ** 2) / 90 ** 2 + ((y - 205) ** 2) / 145 ** 2 <= 1;
  }

  function handleSvgClick(e) {
    if (readOnly || showPhotoPicker) return;
    if (e.target.closest(".marker-dot")) return;
    const { x, y } = getSvgCoords(e);
    if (!isInsideFace(x, y)) return;
    if (tool === "point") {
      setPendingMarker({ x, y });
      if (selectedMuscle) {
        setPendingUnits(String(selectedMuscle.defaultUnits ?? ""));
      }
      setForm({ procedure: "", dose: "", notes: "", color: selectedMuscle?.color ?? "#1F4D46" });
    } else {
      setLinePoints((prev) => [...prev, { x, y }]);
    }
  }

  function handleSvgMouseMove(e) {
    if (tool === "line" && linePoints.length > 0) setMousePos(getSvgCoords(e));
  }

  function confirmMarker() {
    const units = parseFloat(pendingUnits) || 0;
    const marker = {
      id: crypto.randomUUID(),
      type: "point",
      x: pendingMarker.x,
      y: pendingMarker.y,
      ...(selectedMuscle
        ? { muscleId: selectedMuscle.id, muscleName: selectedMuscle.name, tag: selectedMuscle.tag, units, unit: pendingUnit, color: selectedMuscle.color }
        : { ...form, units, unit: form.unit }),
    };
    onChange([...markers, marker]);
    setPendingMarker(null);
    setPendingUnits("");
    setPendingUnit("U");
  }

  function confirmLine() {
    if (linePoints.length < 2) return;
    const units = parseFloat(lineForm.units) || 0;
    const marker = {
      id: crypto.randomUUID(),
      type: "line",
      points: linePoints,
      ...(selectedMuscle
        ? { muscleId: selectedMuscle.id, muscleName: selectedMuscle.name, tag: selectedMuscle.tag, units, unit: lineForm.unit, color: selectedMuscle.color }
        : { ...lineForm, units }),
    };
    onChange([...markers, marker]);
    setLinePoints([]);
    setLineForm({ label: "", notes: "", color: "#1F4D46", units: "", unit: "U" });
  }

  function removeMarker(id) { onChange(markers.filter((m) => m.id !== id)); }

  function svgToPercent(x, y) {
    return { left: `${(x / SVG_W) * 100}%`, top: `${(y / svgH) * 100}%` };
  }

  function switchTool(t) { setTool(t); setLinePoints([]); setPendingMarker(null); }

  const pointMarkers = markers.filter((m) => !m.type || m.type === "point");
  const lineMarkers  = markers.filter((m) => m.type === "line");

  // Soma total de unidades, agrupado por tipo de unidade (U, ml, mg, etc.)
  const totalsByUnit = markers.reduce((acc, m) => {
    const qty = parseFloat(m.units) || 0;
    if (qty <= 0) return acc;
    const u = m.unit ?? "U";
    acc[u] = (acc[u] ?? 0) + qty;
    return acc;
  }, {});
  const totalEntries = Object.entries(totalsByUnit);

  const pendingPanel = (
    <>
      {/* POINT FORM */}
      {pendingMarker && (
        <div className="bg-white border-2 rounded-2xl p-4 mb-4 shadow-sm" style={{ borderColor: selectedMuscle?.color ?? "#1F4D46" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-[#1F4D46]">
                {selectedMuscle ? selectedMuscle.name : "Novo ponto"}
              </p>
              {selectedMuscle && <p className="text-xs text-gray-400">{selectedMuscle.description}</p>}
            </div>
            <button onClick={() => setPendingMarker(null)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="space-y-2.5">
            {selectedMuscle ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantidade</label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.5"
                    value={pendingUnits}
                    onChange={(e) => setPendingUnits(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmMarker()}
                    className="flex-1 border border-[#C2A56B] rounded-lg p-2 text-sm"
                    placeholder="Ex: 4"
                  />
                  <select
                    value={pendingUnit}
                    onChange={(e) => setPendingUnit(e.target.value)}
                    className="border border-[#C2A56B] rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="U">U</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="un">un</option>
                    <option value="fios">fios</option>
                    <option value="seringas">ser.</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                {procedures.length > 0 ? (
                  <select value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })}
                    className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm">
                    <option value="">Selecione o procedimento</option>
                    {procedures.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                ) : (
                  <input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })}
                    placeholder="Procedimento" className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm" />
                )}
                <div className="flex gap-2">
                  <input value={pendingUnits} onChange={(e) => setPendingUnits(e.target.value)}
                    type="number" min="0" step="0.5"
                    placeholder="Quantidade" className="flex-1 border border-[#C2A56B] rounded-lg p-2 text-sm" />
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="border border-[#C2A56B] rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="U">U</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="un">un</option>
                    <option value="fios">fios</option>
                    <option value="seringas">ser.</option>
                  </select>
                </div>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observação" className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm" />
                <ColorPicker color={form.color} onChange={(c) => setForm({ ...form, color: c })} />
              </>
            )}
            <button onClick={confirmMarker}
              className="w-full text-white py-2 rounded-xl text-sm font-medium transition"
              style={{ backgroundColor: selectedMuscle?.color ?? "#1F4D46" }}>
              Confirmar ponto
            </button>
          </div>
        </div>
      )}

      {/* LINE FORM */}
      {linePoints.length > 0 && (
        <div className="bg-white border-2 rounded-2xl p-4 mb-4 shadow-sm" style={{ borderColor: selectedMuscle?.color ?? "#1F4D46" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-[#1F4D46]">
                {selectedMuscle ? selectedMuscle.name : "Traço em andamento"}
              </p>
              {selectedMuscle && <p className="text-xs text-gray-400">{selectedMuscle.description}</p>}
            </div>
            <button onClick={() => setLinePoints([])}><X size={16} className="text-gray-400" /></button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {linePoints.length} ponto{linePoints.length !== 1 ? "s" : ""} — clique para adicionar mais
          </p>
          <div className="space-y-2.5">
            {selectedMuscle ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantidade</label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.5"
                    value={lineForm.units}
                    onChange={(e) => setLineForm({ ...lineForm, units: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && confirmLine()}
                    className="flex-1 border border-[#C2A56B] rounded-lg p-2 text-sm"
                    placeholder={`Ex: ${selectedMuscle.defaultUnits}`}
                  />
                  <select
                    value={lineForm.unit}
                    onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                    className="border border-[#C2A56B] rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="U">U</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="un">un</option>
                    <option value="fios">fios</option>
                    <option value="seringas">ser.</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <input value={lineForm.label} onChange={(e) => setLineForm({ ...lineForm, label: e.target.value })}
                  placeholder="Rótulo (ex: Botox frontal)" className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm" />
                <div className="flex gap-2">
                  <input value={lineForm.units} onChange={(e) => setLineForm({ ...lineForm, units: e.target.value })}
                    type="number" min="0" step="0.5"
                    placeholder="Quantidade" className="flex-1 border border-[#C2A56B] rounded-lg p-2 text-sm" />
                  <select
                    value={lineForm.unit}
                    onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                    className="border border-[#C2A56B] rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="U">U</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="un">un</option>
                    <option value="fios">fios</option>
                    <option value="seringas">ser.</option>
                  </select>
                </div>
                <input value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })}
                  placeholder="Observação" className="w-full border border-[#C2A56B] rounded-lg p-2 text-sm" />
                <ColorPicker color={lineForm.color} onChange={(c) => setLineForm({ ...lineForm, color: c })} />
              </>
            )}
            <button onClick={confirmLine} disabled={linePoints.length < 2}
              className="w-full text-white py-2 rounded-xl text-sm font-medium disabled:opacity-40 transition"
              style={{ backgroundColor: selectedMuscle?.color ?? "#1F4D46" }}>
              Confirmar traço
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col md:flex-row gap-6 items-start"}>
      {/* ── LEFT: face canvas ── */}
      <div className={compact ? "w-full" : "w-full md:shrink-0"} style={compact ? undefined : { maxWidth: SVG_W }}>

        {!readOnly && (
          <div className="no-print">
            {/* Tool bar */}
            <div className="flex gap-1 mb-2 bg-[#F5F1EA] border border-[#D8CDB9] rounded-xl p-1">
              <button onClick={() => switchTool("point")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${tool === "point" ? "bg-[#1F4D46] text-white" : "text-[#1F4D46] hover:bg-[#E8E0D2]"}`}>
                <Dot size={14} /> Ponto
              </button>
              <button onClick={() => switchTool("line")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${tool === "line" ? "bg-[#1F4D46] text-white" : "text-[#1F4D46] hover:bg-[#E8E0D2]"}`}>
                <Minus size={14} /> Traço
              </button>
            </div>

            {/* Photo background bar */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setShowPhotoPicker((v) => !v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  backgroundPhotoId
                    ? "border-[#1F4D46] bg-[#E8E0D2] text-[#1F4D46]"
                    : "border-[#C2A56B] text-gray-500 hover:bg-[#E8E0D2]"
                }`}>
                <ImageIcon size={13} />
                {backgroundPhotoId ? "Foto do paciente ativa" : "Usar foto do paciente"}
              </button>
              {backgroundPhotoId && (
                <button onClick={() => onBgChange?.(null)}
                  className="px-2.5 py-1.5 rounded-lg text-xs border border-[#C2A56B] text-gray-400 hover:text-red-400 transition">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Photo picker */}
            {showPhotoPicker && (
              <div className="mb-2 border border-[#D8CDB9] rounded-xl bg-white p-2">
                {photos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhuma foto cadastrada para este paciente</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                    {photos.map((p) => (
                      <button key={p.id}
                        onClick={() => { onBgChange?.(p.id); setShowPhotoPicker(false); }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition ${backgroundPhotoId === p.id ? "border-[#1F4D46]" : "border-transparent hover:border-[#C2A56B]"}`}>
                        <img src={photoUrl(p.id)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SVG canvas */}
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${svgH}`}
            onClick={handleSvgClick}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setMousePos(null)}
            className={`block w-full rounded-2xl overflow-hidden shadow-sm ${readOnly ? "" : "cursor-crosshair"}`}
            style={{ userSelect: "none", height: "auto" }}
          >
            <defs>
              <radialGradient id="gFace" cx="50%" cy="28%" r="72%">
                <stop offset="0%"   stopColor="#FDE8D0" />
                <stop offset="50%"  stopColor="#F5CFA0" />
                <stop offset="100%" stopColor="#E8B880" />
              </radialGradient>
              <linearGradient id="gNeck" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#D4A060" />
                <stop offset="20%"  stopColor="#EEC898" />
                <stop offset="80%"  stopColor="#EEC898" />
                <stop offset="100%" stopColor="#D4A060" />
              </linearGradient>
              <linearGradient id="gShoulder" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#F0C898" />
                <stop offset="100%" stopColor="#E8B880" />
              </linearGradient>
              <radialGradient id="gBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#E89070" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#E89070" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="gIrisL" cx="40%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#9ABECE" />
                <stop offset="100%" stopColor="#4A7888" />
              </radialGradient>
              <radialGradient id="gIrisR" cx="40%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#9ABECE" />
                <stop offset="100%" stopColor="#4A7888" />
              </radialGradient>
            </defs>

            {backgroundPhotoId ? (
              /* ── PATIENT PHOTO BACKGROUND ── */
              <>
                <image href={photoUrl(backgroundPhotoId)} x="0" y="0" width={SVG_W} height={svgH} preserveAspectRatio="xMidYMid slice" />
                <rect x="0" y="0" width={SVG_W} height={svgH} fill="transparent" />
              </>
            ) : baseImage ? (
              /* ── PRESET FACE IMAGE ── */
              <>
                <image href={baseImage} x="0" y="0" width={SVG_W} height={svgH} preserveAspectRatio="xMidYMid meet" />
                <rect x="0" y="0" width={SVG_W} height={svgH} fill="transparent" />
              </>
            ) : (
              /* ── BUILT-IN FACE ILLUSTRATION ── */
              <>
                {/* background */}
                <rect width={SVG_W} height={SVG_H} fill="white" />

                {/* ── SHOULDERS ── */}
                <path d="M 0 440 L 0 416 Q 28 400 72 394 Q 108 390 132 392 L 138 410 Q 160 406 160 406 Q 160 406 182 410 L 188 392 Q 212 390 248 394 Q 292 400 320 416 L 320 440 Z"
                  fill="url(#gShoulder)" stroke="#2A1A0E" strokeWidth="1.6" />
                {/* collarbone hint */}
                <path d="M 138 410 Q 104 400 72 406" fill="none" stroke="#2A1A0E" strokeWidth="1.3" opacity="0.45" strokeLinecap="round" />
                <path d="M 182 410 Q 216 400 248 406" fill="none" stroke="#2A1A0E" strokeWidth="1.3" opacity="0.45" strokeLinecap="round" />
                {/* sternal notch */}
                <path d="M 155 406 Q 160 412 165 406" fill="none" stroke="#2A1A0E" strokeWidth="1" opacity="0.35" strokeLinecap="round" />

                {/* ── NECK ── */}
                <path d="M 130 340 C 128 360 124 378 120 392 L 200 392 C 196 378 192 360 190 340"
                  fill="url(#gNeck)" stroke="#2A1A0E" strokeWidth="1.6" />
                {/* neck shadow lines */}
                <path d="M 138 346 C 137 364 136 380 136 394" fill="none" stroke="#C07840" strokeWidth="2.2" opacity="0.18" strokeLinecap="round" />
                <path d="M 182 346 C 183 364 184 380 184 394" fill="none" stroke="#C07840" strokeWidth="2.2" opacity="0.18" strokeLinecap="round" />

                {/* ── LEFT EAR ── */}
                <path d="M 64 220 Q 52 214 50 230 Q 49 246 56 253 Q 62 258 65 252 Q 57 244 57 231 Q 57 219 64 216 Z"
                  fill="#EEC090" stroke="#2A1A0E" strokeWidth="1.2" />
                <path d="M 56 222 Q 51 232 53 245" fill="none" stroke="#C07840" strokeWidth="1" opacity="0.5" />

                {/* ── RIGHT EAR ── */}
                <path d="M 256 220 Q 268 214 270 230 Q 271 246 264 253 Q 258 258 255 252 Q 263 244 263 231 Q 263 219 256 216 Z"
                  fill="#EEC090" stroke="#2A1A0E" strokeWidth="1.2" />
                <path d="M 264 222 Q 269 232 267 245" fill="none" stroke="#C07840" strokeWidth="1" opacity="0.5" />

                {/* ── HEAD SHAPE ── */}
                <path d="M 160 60
                  C 200 60 248 92 252 152
                  C 258 216 244 274 222 314
                  C 206 342 184 352 160 352
                  C 136 352 114 342 98 314
                  C 76 274 62 216 68 152
                  C 72 92 120 60 160 60 Z"
                  fill="url(#gFace)" stroke="#2A1A0E" strokeWidth="1.7" />

                {/* forehead highlight */}
                <ellipse cx="160" cy="98" rx="44" ry="26" fill="white" opacity="0.11" />

                {/* temple shading */}
                <ellipse cx="72" cy="210" rx="16" ry="54" fill="#B87840" opacity="0.08" />
                <ellipse cx="248" cy="210" rx="16" ry="54" fill="#B87840" opacity="0.08" />

                {/* cheek shading */}
                <ellipse cx="105" cy="264" rx="38" ry="24" fill="#D07848" opacity="0.08" />
                <ellipse cx="215" cy="264" rx="38" ry="24" fill="#D07848" opacity="0.08" />

                {/* cheek blush */}
                <ellipse cx="104" cy="268" rx="42" ry="26" fill="url(#gBlush)" />
                <ellipse cx="216" cy="268" rx="42" ry="26" fill="url(#gBlush)" />

                {/* ── HAIR BANDS (sides, behind face outline) ── */}
                <path d="M 68 152 C 65 124 72 98 88 80 Q 110 62 140 58 C 124 58 160 60 160 60 C 128 60 78 82 70 130 Z"
                  fill="#9A8468" />
                <path d="M 252 152 C 255 124 248 98 232 80 Q 210 62 180 58 C 196 58 160 60 160 60 C 192 60 242 82 250 130 Z"
                  fill="#9A8468" />

                {/* temple wisps */}
                <path d="M 68 152 Q 71 136 78 122" fill="none" stroke="#7A6040" strokeWidth="2.5" opacity="0.55" strokeLinecap="round" />
                <path d="M 71 143 Q 75 128 84 115" fill="none" stroke="#8A7050" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
                <path d="M 252 152 Q 249 136 242 122" fill="none" stroke="#7A6040" strokeWidth="2.5" opacity="0.55" strokeLinecap="round" />
                <path d="M 249 143 Q 245 128 236 115" fill="none" stroke="#8A7050" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />

                {/* ── BUN ── */}
                <ellipse cx="160" cy="36" rx="48" ry="30" fill="#9A8468" stroke="#7A6040" strokeWidth="1.3" />
                {/* bun hair lines */}
                <path d="M 118 52 Q 138 44 160 42 Q 182 44 202 52" fill="none" stroke="#6A5030" strokeWidth="1.1" opacity="0.5" />
                <path d="M 126 62 Q 142 55 160 53 Q 178 55 194 62" fill="none" stroke="#6A5030" strokeWidth="1" opacity="0.4" />
                {/* bun highlight */}
                <path d="M 148 18 Q 156 10 170 14 Q 164 6 148 10 Z" fill="#C8B090" opacity="0.7" />

                {/* ── EYEBROWS ── */}
                {/* left */}
                <path d="M 94 166 Q 112 152 136 154 Q 152 156 160 164 Q 152 160 135 159 Q 112 158 96 170 Z"
                  fill="#6A4E30" />
                {/* right */}
                <path d="M 160 164 Q 168 156 184 154 Q 208 152 226 166 Q 224 170 206 159 Q 184 159 162 160 Z"
                  fill="#6A4E30" />

                {/* ── LEFT EYE ── */}
                {/* socket shadow */}
                <ellipse cx="120" cy="188" rx="28" ry="18" fill="#C07840" opacity="0.07" />
                {/* sclera */}
                <path d="M 96 188 Q 108 174 124 172 Q 138 174 148 188 Q 138 202 124 204 Q 108 202 96 188 Z"
                  fill="white" stroke="#3A2010" strokeWidth="0.7" opacity="0.92" />
                {/* iris */}
                <circle cx="122" cy="188" r="12" fill="url(#gIrisL)" />
                <circle cx="122" cy="188" r="12" fill="none" stroke="#2A4E68" strokeWidth="1.6" opacity="0.4" />
                {/* pupil */}
                <circle cx="122" cy="188" r="5.8" fill="#101820" />
                {/* highlights */}
                <circle cx="126" cy="184" r="3.4" fill="white" opacity="0.92" />
                <circle cx="117" cy="193" r="1.5" fill="white" opacity="0.5" />
                {/* upper eyelid */}
                <path d="M 96 188 Q 108 174 124 172 Q 138 174 148 188"
                  stroke="#1A0A04" strokeWidth="2.3" fill="none" strokeLinecap="round" />
                {/* eyelid crease */}
                <path d="M 98 184 Q 122 171 146 184"
                  stroke="#7A4030" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.35" />
                {/* lower lid */}
                <path d="M 96 188 Q 108 200 124 202 Q 138 200 148 188"
                  stroke="#2A1A0E" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.35" />
                {/* lashes */}
                <line x1="101" y1="181" x2="98"  y2="174" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="111" y1="174" x2="109" y2="167" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="122" y1="171" x2="121" y2="164" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="133" y1="174" x2="135" y2="167" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="145" y1="181" x2="149" y2="174" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />

                {/* ── RIGHT EYE ── */}
                <ellipse cx="200" cy="188" rx="28" ry="18" fill="#C07840" opacity="0.07" />
                <path d="M 172 188 Q 182 174 196 172 Q 210 174 224 188 Q 210 202 196 204 Q 182 202 172 188 Z"
                  fill="white" stroke="#3A2010" strokeWidth="0.7" opacity="0.92" />
                <circle cx="198" cy="188" r="12" fill="url(#gIrisR)" />
                <circle cx="198" cy="188" r="12" fill="none" stroke="#2A4E68" strokeWidth="1.6" opacity="0.4" />
                <circle cx="198" cy="188" r="5.8" fill="#101820" />
                <circle cx="202" cy="184" r="3.4" fill="white" opacity="0.92" />
                <circle cx="193" cy="193" r="1.5" fill="white" opacity="0.5" />
                <path d="M 172 188 Q 182 174 196 172 Q 210 174 224 188"
                  stroke="#1A0A04" strokeWidth="2.3" fill="none" strokeLinecap="round" />
                <path d="M 174 184 Q 198 171 222 184"
                  stroke="#7A4030" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.35" />
                <path d="M 172 188 Q 182 200 196 202 Q 210 200 224 188"
                  stroke="#2A1A0E" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.35" />
                <line x1="176" y1="181" x2="173" y2="174" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="186" y1="174" x2="184" y2="167" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="197" y1="171" x2="196" y2="164" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="208" y1="174" x2="210" y2="167" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="220" y1="181" x2="224" y2="174" stroke="#0A0604" strokeWidth="1.5" strokeLinecap="round" />

                {/* ── NOSE ── */}
                {/* bridge lines */}
                <path d="M 150 206 L 144 242 Q 140 252 132 250"
                  fill="none" stroke="#B07840" strokeWidth="1.1" strokeLinecap="round" opacity="0.42" />
                <path d="M 170 206 L 176 242 Q 180 252 188 250"
                  fill="none" stroke="#B07840" strokeWidth="1.1" strokeLinecap="round" opacity="0.42" />
                {/* bridge highlight */}
                <path d="M 157 206 L 155 240" stroke="white" strokeWidth="2" opacity="0.1" strokeLinecap="round" />
                {/* nose base */}
                <path d="M 132 250 Q 160 260 188 250"
                  fill="none" stroke="#8A5030" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                {/* left nostril */}
                <path d="M 133 248 Q 125 240 129 233 Q 135 226 143 233 Q 141 241 137 248 Z"
                  fill="#D09060" stroke="#906030" strokeWidth="0.7" opacity="0.38" />
                {/* right nostril */}
                <path d="M 187 248 Q 195 240 191 233 Q 185 226 177 233 Q 179 241 183 248 Z"
                  fill="#D09060" stroke="#906030" strokeWidth="0.7" opacity="0.38" />
                {/* tip highlight */}
                <ellipse cx="160" cy="254" rx="8" ry="4" fill="white" opacity="0.11" />

                {/* ── NASOLABIAL FOLDS ── */}
                <path d="M 128 250 Q 120 264 122 278" fill="none" stroke="#2A1A0E" strokeWidth="0.8" opacity="0.16" strokeLinecap="round" />
                <path d="M 192 250 Q 200 264 198 278" fill="none" stroke="#2A1A0E" strokeWidth="0.8" opacity="0.16" strokeLinecap="round" />

                {/* ── PHILTRUM ── */}
                <path d="M 150 254 L 148 274" fill="none" stroke="#B07840" strokeWidth="0.7" opacity="0.25" strokeLinecap="round" />
                <path d="M 170 254 L 172 274" fill="none" stroke="#B07840" strokeWidth="0.7" opacity="0.25" strokeLinecap="round" />

                {/* ── LIPS ── */}
                {/* upper (Cupid's bow) */}
                <path d="M 122 278 Q 136 268 146 272 Q 160 262 174 272 Q 184 268 198 278 Q 180 274 160 276 Q 140 274 122 278 Z"
                  fill="#C07870" stroke="#8A4840" strokeWidth="0.8" />
                {/* lower */}
                <path d="M 122 278 Q 140 298 160 302 Q 180 298 198 278 Z"
                  fill="#CC8878" stroke="#8A4840" strokeWidth="0.8" />
                {/* seam */}
                <path d="M 122 278 Q 160 284 198 278" fill="none" stroke="#7A3830" strokeWidth="1.1" opacity="0.6" />
                {/* lower shine */}
                <ellipse cx="160" cy="292" rx="18" ry="5.5" fill="white" opacity="0.18" />
                {/* corners */}
                <path d="M 122 278 Q 119 282 122 286" fill="none" stroke="#2A1A0E" strokeWidth="0.7" opacity="0.28" strokeLinecap="round" />
                <path d="M 198 278 Q 201 282 198 286" fill="none" stroke="#2A1A0E" strokeWidth="0.7" opacity="0.28" strokeLinecap="round" />

                {/* ── CHIN LINE ── */}
                <path d="M 132 326 Q 160 338 188 326" fill="none" stroke="#C08050" strokeWidth="0.9" opacity="0.22" strokeLinecap="round" />

                {/* ── ANATOMICAL REFERENCE LINES ── */}
                {/* midline */}
                <line x1="160" y1="60" x2="160" y2="352" stroke="#4A7060" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.2" />
                {/* eye line */}
                <line x1="68"  y1="188" x2="252" y2="188" stroke="#4A7060" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.2" />
                {/* nose base */}
                <line x1="68"  y1="250" x2="252" y2="250" stroke="#4A7060" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.2" />
                {/* lip line */}
                <line x1="68"  y1="278" x2="252" y2="278" stroke="#4A7060" strokeWidth="0.5" strokeDasharray="5,5" opacity="0.2" />
              </>
            )}

            {/* ── SAVED LINE MARKERS ── */}
            {lineMarkers.map((m) => {
              const mid = m.points[Math.floor(m.points.length / 2)];
              const pts = m.points.map((p) => `${p.x},${p.y}`).join(" ");
              const color = vividColor(m.color);
              return (
                <g key={m.id} className="marker-dot" style={{ cursor: readOnly ? "default" : "pointer" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly) removeMarker(m.id); }}
                >
                  {/* contorno escuro por baixo — destaca a cor neon */}
                  <polyline points={pts} fill="none" stroke="#1A1A1A" strokeWidth="5.5"
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                  {/* traço colorido */}
                  <polyline points={pts} fill="none" stroke={color} strokeWidth="3.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                  {m.units > 0 && (
                    <text x={mid.x + 5} y={mid.y - 5}
                      fontSize="11" fill={color} fontWeight="bold" fontFamily="sans-serif"
                      stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>
                      {m.units}{m.unit ?? "U"}
                    </text>
                  )}
                  {!m.units && m.label && (
                    <text x={m.points[0].x + 6} y={m.points[0].y - 5}
                      fontSize="11" fill={color} fontWeight="bold" fontFamily="sans-serif"
                      stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>
                      {m.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── SAVED POINT MARKERS ── */}
            {pointMarkers.map((m) => {
              const r = hoveredId === m.id ? 6.5 : 5;
              const color = vividColor(m.color);
              return (
                <g key={m.id} className="marker-dot" style={{ cursor: readOnly ? "default" : "pointer" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly) removeMarker(m.id); }}
                >
                  {/* anel escuro externo — destaca a cor neon sobre qualquer fundo */}
                  <circle cx={m.x} cy={m.y} r={r + 1.5} fill="#1A1A1A" opacity="0.35" />
                  {/* borda branca */}
                  <circle cx={m.x} cy={m.y} r={r} fill={color} stroke="white" strokeWidth="2" />
                  {/* brilho central */}
                  <circle cx={m.x - r * 0.3} cy={m.y - r * 0.3} r={r * 0.3} fill="white" opacity="0.55" />
                  {m.units > 0 && (
                    <text x={m.x + 8} y={m.y - 5}
                      fontSize="11" fill={color} fontWeight="bold" fontFamily="sans-serif"
                      stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>
                      {m.units}{m.unit ?? "U"}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── LINE IN PROGRESS ── */}
            {linePoints.length > 0 && (
              <>
                <polyline
                  points={[...linePoints, mousePos || linePoints[linePoints.length - 1]].map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={selectedMuscle?.color ?? lineForm.color} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity="0.55" strokeDasharray="6,3"
                />
                {linePoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="4"
                    fill={selectedMuscle?.color ?? lineForm.color} stroke="white" strokeWidth="1.5" opacity="0.8" />
                ))}
              </>
            )}

            {/* ── PENDING POINT ── */}
            {pendingMarker && (
              <>
                <circle cx={pendingMarker.x} cy={pendingMarker.y} r={9} fill="#1A1A1A" opacity="0.25" />
                <circle cx={pendingMarker.x} cy={pendingMarker.y} r={8}
                  fill={form.color} stroke="white" strokeWidth="2.5"
                  opacity="0.85" strokeDasharray="3,2"
                />
              </>
            )}
          </svg>

          {/* ── HOVER TOOLTIP ── */}
          {hoveredId && !pendingMarker && linePoints.length === 0 && (() => {
            const m = markers.find((x) => x.id === hoveredId);
            if (!m) return null;
            const anchor = m.type === "line" ? m.points[0] : m;
            const pct = svgToPercent(anchor.x, anchor.y);
            return (
              <div className="absolute z-20 bg-[#1F4D46] text-white text-xs rounded-xl px-3 py-2 shadow-lg pointer-events-none"
                style={{ ...pct, transform: "translate(-50%, -130%)", maxWidth: 160 }}>
                {(m.procedure || m.label) && <p className="font-semibold">{m.procedure || m.label}</p>}
                {m.dose  && <p className="opacity-80">Dose: {m.dose}</p>}
                {m.notes && <p className="opacity-70 mt-0.5">{m.notes}</p>}
                {!readOnly && <p className="opacity-50 mt-1 text-center">Clique para remover</p>}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Em modo compacto o form aparece abaixo da face */}
      {compact && pendingPanel}

      {/* ── RIGHT PANEL (modo normal) ── */}
      {!compact && (
        <div className="flex-1 min-w-0 no-print w-full md:w-auto">
          {pendingPanel}

          {/* MARKERS LIST */}
          {markers.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {markers.length} marca{markers.length !== 1 ? "s" : ""}
                </p>
                {totalEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {totalEntries.map(([unit, total]) => (
                      <span key={unit} className="text-xs font-semibold bg-[#1F4D46] text-white px-2.5 py-1 rounded-full">
                        Total: {Number.isInteger(total) ? total : total.toFixed(1)} {unit}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {markers.map((m, i) => (
                  <div key={m.id} className="flex items-start justify-between bg-[#F5F1EA] border border-[#D8CDB9] rounded-xl px-3 py-2">
                    <div className="flex items-start gap-2.5">
                      {m.type === "line"
                        ? <div className="w-5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: vividColor(m.color) }} />
                        : <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: vividColor(m.color) }} />
                      }
                      <div>
                        <p className="text-sm font-medium text-[#1F4D46]">
                          {m.procedure || m.muscleName || m.label || (m.type === "line" ? `Traço ${i + 1}` : `Ponto ${i + 1}`)}
                          {m.units > 0 && <span className="text-xs text-gray-500 ml-1.5">({m.units}{m.unit ?? "U"})</span>}
                        </p>
                        {m.notes && <p className="text-xs text-gray-400">{m.notes}</p>}
                      </div>
                    </div>
                    {!readOnly && (
                      <button onClick={() => removeMarker(m.id)} className="text-red-300 hover:text-red-500 shrink-0 ml-2">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : !pendingMarker && linePoints.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">
                {tool === "point" ? "Clique no rosto para marcar pontos de aplicação" : "Clique para traçar linhas no rosto"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ color, onChange }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">Cor</p>
      <div className="flex gap-2">
        {MARKER_COLORS.map((c) => (
          <button key={c.value} type="button" title={c.label} onClick={() => onChange(c.value)}
            className={`w-6 h-6 rounded-full border-2 transition ${color === c.value ? "border-[#1F4D46] scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c.value }} />
        ))}
      </div>
    </div>
  );
}
