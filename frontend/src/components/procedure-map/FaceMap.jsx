import { useRef, useState, useEffect } from "react";
import { X, Trash2, Dot, Minus, ImageIcon, Eraser, Pencil, Slash } from "lucide-react";
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

// Paleta ampliada p/ o modo desenho (Paint): cores da caneta/traço.
const DRAW_COLORS = [
  "#00704A", "#00E676", "#00B0FF", "#2962FF", "#B026FF", "#FF2D95",
  "#FF1744", "#FF6D00", "#FFD600", "#795548", "#212121", "#FFFFFF",
];

// Espessuras disponíveis para caneta/traço (px no viewBox do SVG).
const STROKE_WIDTHS = [1.5, 2.5, 4, 6];

// Forma do marcador por geração: gen 0 = atendimento atual (círculo),
// gen 1 = retorno anterior (estrela), gen 2 = quadrado, gen 3+ = triângulo.
const GEN_SHAPES = ["circle", "star", "square", "triangle"];
export function shapeForGen(gen = 0) {
  return GEN_SHAPES[Math.min(gen, GEN_SHAPES.length - 1)];
}
export const GEN_SHAPE_LABEL = { circle: "Atendimento atual", star: "Retorno anterior", square: "Atendimento anterior", triangle: "Mais antigo" };

// Gera o `points`/`d` de uma forma centrada em (cx,cy) com raio r.
function starPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`);
  }
  return pts.join(" ");
}
function trianglePoints(cx, cy, r) {
  return [
    `${cx},${cy - r}`,
    `${cx - r * 0.87},${cy + r * 0.5}`,
    `${cx + r * 0.87},${cy + r * 0.5}`,
  ].join(" ");
}

// Ícone SVG de uma forma (p/ a legenda de atendimentos). size em px.
export function ShapeSwatch({ shape, color = "#00704A", size = 14 }) {
  const c = size / 2, r = size * 0.4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {shape === "star" && <polygon points={starPoints(c, c, r)} fill={color} stroke="white" strokeWidth="0.6" />}
      {shape === "square" && <rect x={c - r} y={c - r} width={r * 2} height={r * 2} rx="1" fill={color} stroke="white" strokeWidth="0.6" />}
      {shape === "triangle" && <polygon points={trianglePoints(c, c, r)} fill={color} stroke="white" strokeWidth="0.6" />}
      {(!shape || shape === "circle") && <circle cx={c} cy={c} r={r} fill={color} stroke="white" strokeWidth="0.6" />}
    </svg>
  );
}

// Paleta fixa para a LEGENDA de produtos: cada produto do mapa ganha uma cor
// (por posição) e um número, exibidos no marcador e na legenda impressa.
export const PRODUCT_LEGEND_COLORS = [
  "#00704A", // verde institucional
  "#B026FF", // roxo
  "#00B0FF", // azul
  "#FF6D00", // laranja
  "#FF2D95", // rosa
  "#C4895A", // âmbar
  "#E2574C", // vermelho
  "#3A9B6F", // verde claro
];

// Mapa productId -> { index (1-based), color } com base na ordem da lista.
export function buildProductLegend(products = []) {
  const legend = {};
  (products || []).forEach((p, i) => {
    if (!p?.id) return;
    legend[p.id] = {
      index: i + 1,
      color: PRODUCT_LEGEND_COLORS[i % PRODUCT_LEGEND_COLORS.length],
      name: p.productName || `Produto ${i + 1}`,
    };
  });
  return legend;
}

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
  productLegend = null,
  showInherited = true,
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
  const [form, setForm] = useState({ procedure: "", dose: "", notes: "", label: "", color: "#00704A", unit: "U", width: 5 });
  const [hoveredId, setHoveredId] = useState(null);
  const [linePoints, setLinePoints] = useState([]);
  const [lineForm, setLineForm] = useState({ label: "", notes: "", color: "#00704A", units: "", unit: "U", width: 3.5 });
  const [mousePos, setMousePos] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // ── Modo desenho (Paint) ──
  // tool "pen" (mão livre) e "straight" (traço reto) desenham por arrasto.
  const [drawColor, setDrawColor] = useState("#00704A");
  const [drawWidth, setDrawWidth] = useState(2.5);
  const [drawing, setDrawing] = useState(null); // { mode, points:[{x,y}] } em construção
  // Desenho recém-concluído aguardando confirmação no card (quantidade/técnica/obs).
  const [pendingDraw, setPendingDraw] = useState(null); // { mode, d, mid:{x,y} }
  const [drawForm, setDrawForm] = useState({ label: "", notes: "", units: "", unit: "U" });
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") { setLinePoints([]); setPendingMarker(null); setShowPhotoPicker(false); setPendingDraw(null); setDrawing(null); }
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
    if (readOnly || showPhotoPicker || tool === "erase") return;
    // Modos de desenho (caneta/reta) são tratados por arrasto, não por clique.
    if (tool === "pen" || tool === "straight") return;
    if (e.target.closest(".marker-dot")) return;
    const { x, y } = getSvgCoords(e);
    if (!isInsideFace(x, y)) return;
    if (tool === "point") {
      setPendingMarker({ x, y });
      if (selectedMuscle) {
        setPendingUnits(String(selectedMuscle.defaultUnits ?? ""));
      }
      setForm((f) => ({ procedure: "", dose: "", notes: "", label: "", color: selectedMuscle?.color ?? f.color ?? "#00704A", unit: "U", width: f.width ?? 5 }));
    } else if (tool === "line") {
      setLinePoints((prev) => [...prev, { x, y }]);
    }
  }

  function handleSvgMouseMove(e) {
    if (tool === "line" && linePoints.length > 0) setMousePos(getSvgCoords(e));
    if (drawing) {
      const p = getSvgCoords(e);
      setDrawing((d) => {
        if (!d) return d;
        if (d.mode === "straight") return { ...d, points: [d.points[0], p] };
        return { ...d, points: [...d.points, p] };
      });
    }
  }

  // ── desenho por arrasto (caneta livre / traço reto) ──
  const isDrawTool = tool === "pen" || tool === "straight";
  function handleDrawDown(e) {
    if (readOnly || !isDrawTool || pendingDraw) return;
    const p = getSvgCoords(e);
    setDrawing({ mode: tool, points: [p] });
  }
  function handleDrawUp() {
    if (!drawing) return;
    const pts = drawing.points;
    if (pts.length >= 2) {
      const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
      const mid = pts[Math.floor(pts.length / 2)];
      // Abre o card p/ preencher quantidade/técnica/obs — igual ponto e traço.
      setPendingDraw({ mode: drawing.mode, d, mid });
      setDrawForm({ label: "", notes: "", units: "", unit: "U" });
    }
    setDrawing(null);
  }

  function confirmDraw() {
    if (!pendingDraw) return;
    const units = parseFloat(drawForm.units) || 0;
    onChange((prev) => [...prev, {
      id: crypto.randomUUID(),
      type: "draw",
      mode: pendingDraw.mode,
      d: pendingDraw.d,
      x: pendingDraw.mid.x,
      y: pendingDraw.mid.y,
      color: drawColor,
      strokeWidth: drawWidth,
      label: drawForm.label,
      notes: drawForm.notes,
      units,
      unit: drawForm.unit,
    }]);
    setPendingDraw(null);
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
    onChange((prev) => [...prev, marker]);
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
    onChange((prev) => [...prev, marker]);
    setLinePoints([]);
    setLineForm((f) => ({ label: "", notes: "", color: f.color, units: "", unit: "U", width: f.width }));
  }

  function removeMarker(id) { onChange((prev) => prev.filter((m) => m.id !== id)); }

  function svgToPercent(x, y) {
    return { left: `${(x / SVG_W) * 100}%`, top: `${(y / svgH) * 100}%` };
  }

  function switchTool(t) { setTool(t); setLinePoints([]); setPendingMarker(null); setDrawing(null); setPendingDraw(null); }

  // Marcadores herdados (inherited) vêm de um mapa de retorno: aparecem como
  // "fantasma" (referência) e podem ser ocultados via toggle; nunca são apagados.
  const visibleMarkers = showInherited ? markers : markers.filter((m) => !m.inherited);
  const pointMarkers = visibleMarkers.filter((m) => !m.type || m.type === "point");
  const lineMarkers  = visibleMarkers.filter((m) => m.type === "line");
  const drawMarkers  = visibleMarkers.filter((m) => m.type === "draw");

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
        <div className="bg-white border-2 rounded-2xl p-4 mb-4 shadow-sm" style={{ borderColor: selectedMuscle?.color ?? "#00704A" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-verde">
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
                    className="flex-1 border border-ambar rounded-lg p-2 text-sm"
                    placeholder="Ex: 4"
                  />
                  <select
                    value={pendingUnit}
                    onChange={(e) => setPendingUnit(e.target.value)}
                    className="border border-ambar rounded-lg p-2 text-sm bg-white"
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
                <div className="flex gap-2">
                  <input value={pendingUnits} onChange={(e) => setPendingUnits(e.target.value)}
                    type="number" min="0" step="0.5"
                    placeholder="Quantidade" className="flex-1 border border-ambar rounded-lg p-2 text-sm" />
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="border border-ambar rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="U">U</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="un">un</option>
                    <option value="fios">fios</option>
                    <option value="seringas">ser.</option>
                  </select>
                </div>
                <input value={form.label ?? ""} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Técnica utilizada (ex: Retroinjeção, Bolus)" className="w-full border border-ambar rounded-lg p-2 text-sm" />
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observação" className="w-full border border-ambar rounded-lg p-2 text-sm" />
                <StylePicker color={form.color} onColor={(c) => setForm({ ...form, color: c })}
                  width={form.width} onWidth={(w) => setForm({ ...form, width: w })} />
              </>
            )}
            <button onClick={confirmMarker}
              className="w-full text-white py-2 rounded-xl text-sm font-medium transition"
              style={{ backgroundColor: selectedMuscle?.color ?? "#00704A" }}>
              Confirmar ponto
            </button>
          </div>
        </div>
      )}

      {/* LINE FORM */}
      {linePoints.length > 0 && (
        <div className="bg-white border-2 rounded-2xl p-4 mb-4 shadow-sm" style={{ borderColor: selectedMuscle?.color ?? "#00704A" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-verde">
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
                    className="flex-1 border border-ambar rounded-lg p-2 text-sm"
                    placeholder={`Ex: ${selectedMuscle.defaultUnits}`}
                  />
                  <select
                    value={lineForm.unit}
                    onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                    className="border border-ambar rounded-lg p-2 text-sm bg-white"
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
                  placeholder="Técnica utilizada (ex: Retroinjeção, Bolus)" className="w-full border border-ambar rounded-lg p-2 text-sm" />
                <div className="flex gap-2">
                  <input value={lineForm.units} onChange={(e) => setLineForm({ ...lineForm, units: e.target.value })}
                    type="number" min="0" step="0.5"
                    placeholder="Quantidade" className="flex-1 border border-ambar rounded-lg p-2 text-sm" />
                  <select
                    value={lineForm.unit}
                    onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                    className="border border-ambar rounded-lg p-2 text-sm bg-white"
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
                  placeholder="Observação" className="w-full border border-ambar rounded-lg p-2 text-sm" />
                <StylePicker color={lineForm.color} onColor={(c) => setLineForm({ ...lineForm, color: c })}
                  width={lineForm.width} onWidth={(w) => setLineForm({ ...lineForm, width: w })} />
              </>
            )}
            <button onClick={confirmLine} disabled={linePoints.length < 2}
              className="w-full text-white py-2 rounded-xl text-sm font-medium disabled:opacity-40 transition"
              style={{ backgroundColor: selectedMuscle?.color ?? "#00704A" }}>
              Confirmar traço
            </button>
          </div>
        </div>
      )}

      {/* DRAW FORM (caneta / reta) — mesmo card do ponto e do traço */}
      {pendingDraw && (
        <div className="bg-white border-2 rounded-2xl p-4 mb-4 shadow-sm" style={{ borderColor: drawColor }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-verde">
              {pendingDraw.mode === "straight" ? "Reta desenhada" : "Desenho à mão livre"}
            </p>
            <button onClick={() => setPendingDraw(null)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="space-y-2.5">
            <input value={drawForm.label} onChange={(e) => setDrawForm({ ...drawForm, label: e.target.value })}
              placeholder="Técnica utilizada (ex: Retroinjeção, Bolus)" className="w-full border border-ambar rounded-lg p-2 text-sm" />
            <div className="flex gap-2">
              <input value={drawForm.units} onChange={(e) => setDrawForm({ ...drawForm, units: e.target.value })}
                type="number" min="0" step="0.5"
                placeholder="Quantidade" className="flex-1 border border-ambar rounded-lg p-2 text-sm" />
              <select value={drawForm.unit} onChange={(e) => setDrawForm({ ...drawForm, unit: e.target.value })}
                className="border border-ambar rounded-lg p-2 text-sm bg-white">
                <option value="U">U</option>
                <option value="ml">ml</option>
                <option value="mg">mg</option>
                <option value="un">un</option>
                <option value="fios">fios</option>
                <option value="seringas">ser.</option>
              </select>
            </div>
            <input value={drawForm.notes} onChange={(e) => setDrawForm({ ...drawForm, notes: e.target.value })}
              placeholder="Observação" className="w-full border border-ambar rounded-lg p-2 text-sm" />
            <StylePicker color={drawColor} onColor={setDrawColor} width={drawWidth} onWidth={setDrawWidth} />
            <button onClick={confirmDraw}
              className="w-full text-white py-2 rounded-xl text-sm font-medium transition"
              style={{ backgroundColor: drawColor }}>
              Confirmar {pendingDraw.mode === "straight" ? "reta" : "desenho"}
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
            <div className="grid grid-cols-5 gap-1 mb-2 bg-creme-50 border border-creme-200 rounded-xl p-1">
              <button onClick={() => switchTool("point")}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${tool === "point" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"}`}>
                <Dot size={14} /> Ponto
              </button>
              <button onClick={() => switchTool("line")}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${tool === "line" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"}`}>
                <Minus size={14} /> Traço
              </button>
              <button onClick={() => switchTool("pen")}
                title="Desenhar à mão livre (arraste sobre a imagem)"
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${tool === "pen" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"}`}>
                <Pencil size={14} /> Caneta
              </button>
              <button onClick={() => switchTool("straight")}
                title="Traço reto (arraste do início ao fim)"
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${tool === "straight" ? "bg-verde text-white" : "text-verde hover:bg-creme-100"}`}>
                <Slash size={14} /> Reta
              </button>
              <button onClick={() => switchTool("erase")}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition ${tool === "erase" ? "bg-erro text-white" : "text-erro hover:bg-erro/10"}`}>
                <Eraser size={14} /> Apagar
              </button>
            </div>
            {tool === "erase" && (
              <p className="text-xs text-erro/80 mb-2 flex items-center gap-1.5">
                <Eraser size={12} /> Modo apagar: clique em um ponto, traço ou desenho para removê-lo.
              </p>
            )}

            {/* Dica nos modos caneta/reta: cor/espessura ficam no card ao soltar */}
            {isDrawTool && !pendingDraw && (
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                <Pencil size={12} /> Arraste sobre a imagem para desenhar — ao soltar, preencha o card e confirme.
              </p>
            )}

            {/* Photo background bar */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setShowPhotoPicker((v) => !v)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  backgroundPhotoId
                    ? "border-verde bg-creme-100 text-verde"
                    : "border-ambar text-gray-500 hover:bg-creme-100"
                }`}>
                <ImageIcon size={13} />
                {backgroundPhotoId ? "Foto do paciente ativa" : "Usar foto do paciente"}
              </button>
              {backgroundPhotoId && (
                <button onClick={() => onBgChange?.(null)}
                  className="px-2.5 py-1.5 rounded-lg text-xs border border-ambar text-gray-400 hover:text-red-400 transition">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Photo picker */}
            {showPhotoPicker && (
              <div className="mb-2 border border-creme-200 rounded-xl bg-white p-2">
                {photos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Nenhuma foto cadastrada para este paciente</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                    {photos.map((p) => (
                      <button key={p.id}
                        onClick={() => { onBgChange?.(p.id); setShowPhotoPicker(false); }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition ${backgroundPhotoId === p.id ? "border-verde" : "border-transparent hover:border-ambar"}`}>
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
            onMouseDown={handleDrawDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleDrawUp}
            onMouseLeave={() => { setMousePos(null); handleDrawUp(); }}
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

            {/* ── SAVED DRAWINGS (modo Paint: caneta livre / traço reto) ── */}
            {drawMarkers.map((m) => {
              const ghost = !!m.inherited;
              const color = m.color || "#00704A";
              const txt = m.units > 0 ? `${m.units}${m.unit ?? "U"}` : (m.label || "");
              return (
                <g key={m.id} className="marker-dot"
                  style={{ cursor: readOnly || ghost ? "default" : tool === "erase" ? "pointer" : "default" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly && !ghost && tool === "erase") removeMarker(m.id); }}
                >
                  <path d={m.d} fill="none" stroke={color} strokeWidth={m.strokeWidth || 2.5}
                    strokeLinecap="round" strokeLinejoin="round"
                    opacity={ghost ? 0.4 : 1} strokeDasharray={ghost ? "4,3" : undefined} />
                  {txt && m.x != null && (
                    <text x={m.x + 5} y={m.y - 5} fontSize="11" fill={color} fontWeight="bold"
                      fontFamily="sans-serif" stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>{txt}</text>
                  )}
                </g>
              );
            })}

            {/* desenho em construção (feedback ao vivo) */}
            {drawing && drawing.points.length >= 1 && (
              <path
                d={drawing.points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")}
                fill="none" stroke={drawColor} strokeWidth={drawWidth}
                strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* desenho pendente (aguardando confirmação no card) — tracejado,
                atualiza ao vivo se a cor/espessura mudarem no card */}
            {pendingDraw && (
              <path d={pendingDraw.d} fill="none" stroke={drawColor} strokeWidth={drawWidth}
                strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
                strokeDasharray="6,3" style={{ pointerEvents: "none" }} />
            )}

            {/* ── SAVED LINE MARKERS ── */}
            {lineMarkers.map((m) => {
              const mid = m.points[Math.floor(m.points.length / 2)];
              const pts = m.points.map((p) => `${p.x},${p.y}`).join(" ");
              const color = vividColor(m.color);
              return (
                <g key={m.id} className="marker-dot" style={{ cursor: readOnly ? "default" : tool === "erase" ? "pointer" : "default" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly && tool === "erase") removeMarker(m.id); }}
                >
                  {/* contorno escuro por baixo — destaca a cor neon */}
                  <polyline points={pts} fill="none" stroke="#1A1A1A" strokeWidth={(m.width || 3.5) + 2}
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                  {/* traço colorido */}
                  <polyline points={pts} fill="none" stroke={color} strokeWidth={m.width || 3.5}
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
              const ghost = !!m.inherited;
              const baseR = m.width || 5; // espessura controla o tamanho do ponto
              const r = (hoveredId === m.id ? baseR + 1.5 : baseR) * (ghost ? 0.85 : 1);
              const color = vividColor(m.color);
              const leg = productLegend && m.productId ? productLegend[m.productId] : null;
              // Forma pela geração: atual = círculo, retornos anteriores = estrela/quadrado/triângulo.
              const shape = shapeForGen(m.gen);
              const sr = shape === "circle" ? r : r * 1.25; // formas não-círculo um pouco maiores p/ legibilidade
              const shapeEl = (fill, stroke, strokeWidth, dash) => {
                const common = { fill, stroke, strokeWidth, ...(dash ? { strokeDasharray: dash } : {}) };
                if (shape === "star")     return <polygon points={starPoints(m.x, m.y, sr)} strokeLinejoin="round" {...common} />;
                if (shape === "square")   return <rect x={m.x - sr} y={m.y - sr} width={sr * 2} height={sr * 2} rx={1} {...common} />;
                if (shape === "triangle") return <polygon points={trianglePoints(m.x, m.y, sr)} strokeLinejoin="round" {...common} />;
                return <circle cx={m.x} cy={m.y} r={r} {...common} />;
              };
              return (
                <g key={m.id} className="marker-dot"
                  style={{ cursor: readOnly || ghost ? "default" : tool === "erase" ? "pointer" : "default", opacity: ghost ? 0.55 : 1 }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly && !ghost && tool === "erase") removeMarker(m.id); }}
                >
                  {ghost ? (
                    // marcador de atendimento anterior: forma por geração, tracejado
                    shapeEl(color, "white", 1.4, "2,1.5")
                  ) : (
                    <>
                      {/* halo escuro externo — destaca a cor neon sobre qualquer fundo */}
                      {shape === "circle"
                        ? <circle cx={m.x} cy={m.y} r={r + 1.5} fill="#1A1A1A" opacity="0.35" />
                        : null}
                      {/* forma preenchida com borda branca */}
                      {shapeEl(color, "white", 2)}
                      {/* brilho central (só no círculo) */}
                      {shape === "circle" && (
                        <circle cx={m.x - r * 0.3} cy={m.y - r * 0.3} r={r * 0.3} fill="white" opacity="0.55" />
                      )}
                    </>
                  )}
                  {/* badge numérico do produto (legenda) */}
                  {leg && (
                    <g style={{ pointerEvents: "none" }}>
                      <circle cx={m.x + r + 1} cy={m.y - r - 1} r={4.6} fill={leg.color} stroke="white" strokeWidth="1.2" />
                      <text x={m.x + r + 1} y={m.y - r + 1.6} fontSize="6.5" fill="white" fontWeight="bold"
                        fontFamily="sans-serif" textAnchor="middle">{leg.index}</text>
                    </g>
                  )}
                  {m.units > 0 ? (
                    <text x={m.x + 8} y={m.y - 5}
                      fontSize="11" fill={color} fontWeight="bold" fontFamily="sans-serif"
                      stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>
                      {m.units}{m.unit ?? "U"}
                    </text>
                  ) : m.label ? (
                    <text x={m.x + 8} y={m.y - 5}
                      fontSize="11" fill={color} fontWeight="bold" fontFamily="sans-serif"
                      stroke="white" strokeWidth="0.6" paintOrder="stroke"
                      style={{ pointerEvents: "none" }}>
                      {m.label}
                    </text>
                  ) : null}
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
              <div className="absolute z-20 bg-verde text-white text-xs rounded-xl px-3 py-2 shadow-lg pointer-events-none"
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
                      <span key={unit} className="text-xs font-semibold bg-verde text-white px-2.5 py-1 rounded-full">
                        Total: {Number.isInteger(total) ? total : total.toFixed(1)} {unit}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {markers.map((m, i) => (
                  <div key={m.id} className="flex items-start justify-between bg-creme-50 border border-creme-200 rounded-xl px-3 py-2">
                    <div className="flex items-start gap-2.5">
                      {m.type === "line"
                        ? <div className="w-5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: vividColor(m.color) }} />
                        : <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: vividColor(m.color) }} />
                      }
                      <div>
                        <p className="text-sm font-medium text-verde">
                          {m.procedure || m.muscleName || m.label || (m.type === "line" ? `Traço ${i + 1}` : `Ponto ${i + 1}`)}
                          {m.units > 0 && <span className="text-xs font-mono text-gray-500 ml-1.5">({m.units}{m.unit ?? "U"})</span>}
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
                {tool === "erase"
                  ? "Modo apagar: clique em uma marca para removê-la"
                  : tool === "point"
                    ? "Clique no rosto para marcar pontos de aplicação"
                    : "Clique para traçar linhas no rosto"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Seletor unificado de cor (paleta ampliada) + espessura — mesmo padrão da
// caneta, usado por ponto e traço. `width`/`onWidth` são opcionais (omitidos
// quando o controle de espessura não faz sentido, ex.: marcador de músculo).
function StylePicker({ color, onColor, width, onWidth }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Cor</p>
        <div className="flex flex-wrap gap-1.5">
          {DRAW_COLORS.map((c) => (
            <button key={c} type="button" title="Cor" onClick={() => onColor(c)}
              className={`w-6 h-6 rounded-full border transition ${color === c ? "ring-2 ring-verde ring-offset-1 scale-110" : "border-creme-200"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      {onWidth && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Espessura</p>
          <div className="flex items-center gap-1.5">
            {STROKE_WIDTHS.map((w) => (
              <button key={w} type="button" title={`Espessura ${w}`} onClick={() => onWidth(w)}
                className={`flex items-center justify-center w-7 h-7 rounded-lg border transition ${width === w ? "border-verde bg-verde-50" : "border-creme-200 hover:bg-creme-50"}`}>
                <span className="rounded-full bg-gray-700" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
