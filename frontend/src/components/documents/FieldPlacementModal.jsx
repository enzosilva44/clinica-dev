import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { X, ChevronLeft, ChevronRight, Save, Trash2, Check } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const FIELD_TYPES = {
  patient_sig:      { label: "Assinatura Paciente",     color: "#00704A", w: 220, h: 80 },
  professional_sig: { label: "Assinatura Profissional", color: "#6F7F73", w: 220, h: 80 },
  text_name:        { label: "Nome",                    color: "#C4895A", w: 130, h: 28 },
  text_date:        { label: "Data",                    color: "#4A8EC2", w: 100, h: 28 },
  text_cpf:         { label: "CPF",                     color: "#9B6BB5", w: 120, h: 28 },
};

export default function FieldPlacementModal({ patientDoc, onClose, onSaved }) {
  const canvasRef  = useRef(null);
  const viewerRef  = useRef(null);
  const renderTask = useRef(null);

  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError,   setPdfError]   = useState("");
  const [pageNum,    setPageNum]    = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fields,     setFields]     = useState(patientDoc.document.fields ?? []);
  const [placing,    setPlacing]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/documents/${patientDoc.document.id}/file?token=${encodeURIComponent(token ?? "")}`;
    pdfjsLib.getDocument({ url }).promise
      .then((doc) => { setPdfDoc(doc); setTotalPages(doc.numPages); })
      .catch(() => { setPdfError("Não foi possível carregar o PDF."); toast.error("Erro ao carregar PDF"); })
      .finally(() => setPdfLoading(false));
  }, [patientDoc.document.id]);

  const renderPage = useCallback(async (num) => {
    if (!pdfDoc || !canvasRef.current) return;
    renderTask.current?.cancel();
    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const viewerWidth = viewerRef.current?.clientWidth ?? 800;
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min((viewerWidth - 48) / vp.width, 1.45);
      const sv = page.getViewport({ scale });
      canvas.width  = Math.floor(sv.width);
      canvas.height = Math.floor(sv.height);
      canvas.style.width  = `${Math.floor(sv.width)}px`;
      canvas.style.height = `${Math.floor(sv.height)}px`;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTask.current = page.render({ canvasContext: ctx, viewport: sv });
      await renderTask.current.promise;
      renderTask.current = null;
    } catch (e) {
      if (e?.name === "RenderingCancelledException") return;
    }
  }, [pdfDoc]);

  useEffect(() => { renderPage(pageNum); }, [pdfDoc, pageNum, renderPage]);
  useEffect(() => {
    if (!viewerRef.current) return;
    const obs = new ResizeObserver(() => renderPage(pageNum));
    obs.observe(viewerRef.current);
    return () => obs.disconnect();
  }, [pageNum, renderPage]);

  function handleCanvasClick(e) {
    if (!placing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setFields((f) => [...f, { id: crypto.randomUUID(), type: placing, page: pageNum, x, y }]);
    setPlacing(null);
  }

  function removeField(id) { setFields((f) => f.filter((x) => x.id !== id)); }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/documents/${patientDoc.document.id}`, { fields });
      toast.success("Campos salvos!");
      onSaved?.(fields);
      onClose();
    } catch {
      toast.error("Erro ao salvar campos");
    } finally {
      setSaving(false);
    }
  }

  const pageFields = fields.filter((f) => f.page === pageNum);
  const hasPatientSig = fields.some((f) => f.type === "patient_sig");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-[#00704A]">Configurar campos — {patientDoc.document.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Clique em um tipo de campo e depois clique no PDF para posicioná-lo</p>
          </div>
          <div className="flex items-center gap-2">
            {!hasPatientSig && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                Adicione ao menos a assinatura do paciente
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasPatientSig}
              className="flex items-center gap-1.5 bg-[#00704A] hover:bg-[#0A3326] disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              <Save size={13} /> {saving ? "Salvando…" : "Salvar configuração"}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* SIDEBAR */}
          <div className="w-64 shrink-0 border-r border-gray-100 p-4 overflow-y-auto flex flex-col gap-5">

            {/* Tipos de campo */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Adicionar campo</p>
              <div className="space-y-1.5">
                {Object.entries(FIELD_TYPES).map(([type, ft]) => (
                  <button
                    key={type}
                    onClick={() => setPlacing(placing === type ? null : type)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition border"
                    style={placing === type
                      ? { backgroundColor: ft.color, borderColor: ft.color, color: "white" }
                      : { borderColor: "#C4895A", color: "#00704A" }
                    }
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: placing === type ? "white" : ft.color }} />
                    {ft.label}
                  </button>
                ))}
              </div>
              {placing && (
                <p className="text-xs text-[#00704A] bg-[#E8F5F0] rounded-lg px-2 py-1.5 mt-2">
                  Clique no PDF para posicionar
                </p>
              )}
            </div>

            {/* Campos posicionados */}
            {fields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Campos ({fields.length})
                </p>
                <div className="space-y-1">
                  {fields.map((f) => {
                    const ft = FIELD_TYPES[f.type];
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ft?.color }} />
                          <span className="text-xs text-gray-600 truncate">{ft?.label}</span>
                          <span className="text-[10px] text-gray-400">p.{f.page}</span>
                        </div>
                        <button onClick={() => removeField(f.id)} className="text-red-300 hover:text-red-500 transition shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="mt-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Checklist</p>
              <div className="space-y-1.5">
                {[
                  { key: "patient_sig",      label: "Assinatura do paciente" },
                  { key: "professional_sig", label: "Assinatura profissional" },
                ].map(({ key, label }) => {
                  const has = fields.some((f) => f.type === key);
                  return (
                    <div key={key} className={`flex items-center gap-2 text-xs ${has ? "text-green-600" : "text-gray-400"}`}>
                      <Check size={12} className={has ? "text-green-500" : "text-gray-300"} />
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PDF VIEWER */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-100">
            {/* Navegação */}
            <div className="flex items-center justify-center gap-3 py-2.5 bg-white border-b border-gray-100 shrink-0">
              <button onClick={() => setPageNum((p) => Math.max(p - 1, 1))} disabled={pageNum === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-600">Pág. {pageNum} / {totalPages}</span>
              <button onClick={() => setPageNum((p) => Math.min(p + 1, totalPages))} disabled={pageNum === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Canvas + overlays */}
            <div ref={viewerRef} className="flex-1 overflow-auto flex justify-center p-4">
              <div className="relative select-none"
                style={{ cursor: placing ? "crosshair" : "default" }}
                onClick={handleCanvasClick}>

                {pdfLoading && <div className="w-[520px] h-[680px] bg-white shadow-lg rounded-sm animate-pulse" />}
                {pdfError   && (
                  <div className="w-[520px] bg-white border border-red-100 shadow-lg rounded-sm p-6 text-center">
                    <p className="text-sm font-semibold text-red-500">{pdfError}</p>
                  </div>
                )}
                <canvas ref={canvasRef} className={`shadow-lg rounded-sm bg-white ${pdfLoading || pdfError ? "hidden" : "block"}`} />

                {/* Overlays dos campos */}
                {!pdfLoading && !pdfError && pageFields.map((f) => {
                  const ft = FIELD_TYPES[f.type];
                  const canvas = canvasRef.current;
                  if (!canvas || !ft) return null;
                  const left = (f.x / 100) * canvas.width;
                  const top  = (f.y / 100) * canvas.height;
                  return (
                    <div
                      key={f.id}
                      className="absolute border-2 rounded flex items-center justify-center group"
                      style={{
                        left, top,
                        width: ft.w, height: ft.h,
                        borderColor: ft.color,
                        backgroundColor: `${ft.color}22`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <span className="text-[10px] font-bold px-1 text-center leading-tight" style={{ color: ft.color }}>
                        {ft.label}
                      </span>
                      <button
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
