import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import SignatureCanvas from "react-signature-canvas";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const FIELD_TYPES = {
  professional_sig: { label: "Profissional", color: "#314D3E", textColor: "white" },
  patient_sig:      { label: "Paciente",      color: "#7C9A92", textColor: "white" },
  text_name:        { label: "Nome",           color: "#C4895A", textColor: "white" },
  text_date:        { label: "Data",           color: "#4A8EC2", textColor: "white" },
  text_cpf:         { label: "CPF",            color: "#9B6BB5", textColor: "white" },
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function SigningModal({ patientDoc, patient, onClose, onSigned }) {
  const isSigned = patientDoc.status === "signed";
  const hasFinalPdf = Boolean(patientDoc.signedFilePath && patientDoc.signedHash);
  const canEditSignature = !hasFinalPdf;
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const viewerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const proSigRef = useRef(null);
  const patSigRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fields, setFields] = useState(patientDoc.document.fields ?? []);
  const [placing, setPlacing] = useState(null);
  const [fieldValues, setFieldValues] = useState(patientDoc.fieldValues ?? {});
  const [signerName, setSignerName] = useState(patientDoc.signerName ?? patient?.name ?? "");
  const [signerCpf, setSignerCpf] = useState(patientDoc.signerCpf ?? patient?.cpf ?? patient?.document ?? "");
  const [step, setStep] = useState(isSigned ? "fill" : "position"); // "position" | "fill"
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/documents/${patientDoc.document.id}/file?token=${encodeURIComponent(token ?? "")}`;
    pdfjsLib.getDocument({ url })
      .promise.then((doc) => {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setPdfError("");
      })
      .catch(() => {
        setPdfError("Não foi possível carregar este PDF.");
        toast.error("Erro ao carregar PDF");
      })
      .finally(() => setPdfLoading(false));
  }, [patientDoc.document.id]);

  const renderPage = useCallback(async (num) => {
    if (!pdfDoc || !canvasRef.current) return;
    renderTaskRef.current?.cancel();

    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const viewerWidth = viewerRef.current?.clientWidth ?? 800;
      const viewerHeight = viewerRef.current?.clientHeight ?? 900;
      const viewport = page.getViewport({ scale: 1 });
      const widthScale = (viewerWidth - 48) / viewport.width;
      const heightScale = (viewerHeight - 48) / viewport.height;
      const scale = Math.max(Math.min(widthScale, heightScale, 1.45), 0.45);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
      canvas.style.height = `${Math.floor(scaledViewport.height)}px`;

      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      renderTaskRef.current = page.render({ canvasContext: context, viewport: scaledViewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
      setPdfError("");
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      setPdfError("Não foi possível renderizar este PDF.");
    }
  }, [pdfDoc]);

  useEffect(() => { renderPage(pageNum); }, [pdfDoc, pageNum, renderPage]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const observer = new ResizeObserver(() => renderPage(pageNum));
    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, [pageNum, renderPage]);

  function handleCanvasClick(e) {
    if (!placing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newField = { id: crypto.randomUUID(), type: placing, page: pageNum, x, y };
    setFields((f) => [...f, newField]);
    setPlacing(null);
  }

  function removeField(id) {
    setFields((f) => f.filter((x) => x.id !== id));
  }

  async function handleSave() {
    if (!signerName.trim()) {
      toast.error("Informe o nome completo do assinante");
      return;
    }
    if (!signerCpf.trim()) {
      toast.error("Informe o CPF do assinante");
      return;
    }

    const requiresProfessionalSignature = fields.some((f) => f.type === "professional_sig");
    const requiresPatientSignature = fields.some((f) => f.type === "patient_sig");
    const proSig = proSigRef.current
      ? (proSigRef.current.isEmpty() ? patientDoc.professionalSignature ?? null : proSigRef.current.toDataURL())
      : patientDoc.professionalSignature ?? null;
    const patSig = patSigRef.current
      ? (patSigRef.current.isEmpty() ? patientDoc.patientSignature ?? null : patSigRef.current.toDataURL())
      : patientDoc.patientSignature ?? null;

    if (requiresProfessionalSignature && !proSig) {
      toast.error("Faça a assinatura do profissional");
      return;
    }
    if (requiresPatientSignature && !patSig) {
      toast.error("Faça a assinatura do paciente");
      return;
    }

    setSaving(true);
    try {
      // Save field positions to document template
      await api.put(`/documents/${patientDoc.document.id}`, { fields });

      await api.put(`/documents/patient-doc/${patientDoc.id}/sign`, {
        fieldValues,
        professionalSignature: proSig,
        patientSignature: patSig,
        signerName: signerName.trim(),
        signerCpf: signerCpf.trim(),
      });
      toast.success("Documento assinado e salvo");
      onSigned?.();
      onClose();
    } catch {
      toast.error("Erro ao salvar documento");
    } finally {
      setSaving(false);
    }
  }

  const pageFields = fields.filter((f) => f.page === pageNum);
  const isSigType = (t) => t === "professional_sig" || t === "patient_sig";
  const getSignature = (type) => (
    type === "professional_sig"
      ? patientDoc.professionalSignature
      : patientDoc.patientSignature
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#314D3E]">
              {isSigned ? "Documento Assinado" : "Assinar Documento"}: {patientDoc.document.name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasFinalPdf
                ? "Campos preenchidos e assinaturas salvas"
                : isSigned
                  ? "Finalize este documento para gerar PDF assinado e auditoria"
                : step === "position"
                  ? "Adicione campos e arraste para posicionar"
                  : "Preencha os campos e assine"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEditSignature && step === "position" && (
              <button
                onClick={() => setStep("fill")}
                className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                Próximo: Assinar →
              </button>
            )}
            {canEditSignature && step === "fill" && (
              <>
                {!isSigned && (
                  <button
                    onClick={() => setStep("position")}
                    className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm hover:bg-[#EFE7DA] transition"
                  >
                    ← Voltar
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#3A9B6F] hover:bg-[#2e7d57] disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
                >
                  {saving ? "Salvando…" : isSigned ? "✓ Gerar PDF Assinado" : "✓ Salvar Documento"}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* SIDEBAR */}
          <div className="w-72 shrink-0 border-r border-gray-100 p-4 overflow-y-auto flex flex-col gap-5">
            {step === "position" ? (
              <>
                {/* Signatures */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assinaturas</p>
                  <div className="space-y-1.5">
                    {["professional_sig", "patient_sig"].map((type) => {
                      const ft = FIELD_TYPES[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setPlacing(placing === type ? null : type)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition border ${
                            placing === type
                              ? "text-white border-transparent"
                              : "border-[#D6C1A3] text-[#314D3E] hover:bg-[#EFE7DA]"
                          }`}
                          style={placing === type ? { backgroundColor: ft.color, borderColor: ft.color } : {}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l4-4 4 4 8-8"/></svg>
                          {ft.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Text fields */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Campos de Texto</p>
                  <div className="space-y-1.5">
                    {["text_name", "text_date", "text_cpf"].map((type) => {
                      const ft = FIELD_TYPES[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setPlacing(placing === type ? null : type)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition border ${
                            placing === type
                              ? "text-white border-transparent"
                              : "border-[#D6C1A3] text-[#314D3E] hover:bg-[#EFE7DA]"
                          }`}
                          style={placing === type ? { backgroundColor: ft.color, borderColor: ft.color } : {}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                          {ft.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Placed fields */}
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
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ft.color }} />
                              <span className="text-xs text-gray-600 truncate">{ft.label}</span>
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
              </>
            ) : (
              <>
                {isSigned && (
                  <div className={`rounded-xl border px-3 py-2 ${hasFinalPdf ? "border-green-100 bg-green-50" : "border-amber-100 bg-amber-50"}`}>
                    <p className={`text-xs font-semibold ${hasFinalPdf ? "text-green-700" : "text-amber-700"}`}>
                      {hasFinalPdf ? "Documento assinado" : "Assinatura antiga"}
                    </p>
                    <p className={`text-xs mt-0.5 ${hasFinalPdf ? "text-green-700/70" : "text-amber-700/70"}`}>
                      {patientDoc.signedAt ? new Date(patientDoc.signedAt).toLocaleString("pt-BR") : "Assinatura salva"}
                    </p>
                    {!hasFinalPdf && (
                      <p className="text-xs text-amber-700/70 mt-1">
                        Gere o PDF final para salvar hash e auditoria.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Identificação</p>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Nome completo</label>
                      <input
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        disabled={!canEditSignature}
                        className="w-full border border-[#D6C1A3] rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">CPF</label>
                      <input
                        value={signerCpf}
                        onChange={(e) => setSignerCpf(e.target.value)}
                        disabled={!canEditSignature}
                        className="w-full border border-[#D6C1A3] rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Fill mode: text fields */}
                {fields.filter((f) => !isSigType(f.type)).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Preencher</p>
                    <div className="space-y-2.5">
                      {fields.filter((f) => !isSigType(f.type)).map((f) => {
                        const ft = FIELD_TYPES[f.type];
                        return (
                          <div key={f.id}>
                            <label className="text-xs font-medium text-gray-500 block mb-1">{ft.label}</label>
                            <input
                              value={fieldValues[f.id] ?? ""}
                              onChange={(e) => setFieldValues((v) => ({ ...v, [f.id]: e.target.value }))}
                              disabled={!canEditSignature}
                              placeholder={ft.label}
                              className="w-full border border-[#D6C1A3] rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Signature pads */}
                {fields.some((f) => f.type === "professional_sig") && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assinatura Profissional</p>
                    <div className="border border-[#D6C1A3] rounded-xl overflow-hidden bg-gray-50">
                      {patientDoc.professionalSignature && !proSigRef.current ? (
                        <img src={patientDoc.professionalSignature} alt="Assinatura profissional" className="w-full h-32 object-contain bg-white" />
                      ) : (
                        <SignatureCanvas
                          ref={proSigRef}
                          canvasProps={{ width: 256, height: 132, className: "w-full h-32" }}
                          penColor="#314D3E"
                        />
                      )}
                    </div>
                    {!isSigned && (
                      <button
                        onClick={() => proSigRef.current?.clear()}
                        className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                )}

                {fields.some((f) => f.type === "patient_sig") && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assinatura Paciente</p>
                    <div className="border border-[#D6C1A3] rounded-xl overflow-hidden bg-gray-50">
                      {patientDoc.patientSignature && !patSigRef.current ? (
                        <img src={patientDoc.patientSignature} alt="Assinatura paciente" className="w-full h-32 object-contain bg-white" />
                      ) : (
                        <SignatureCanvas
                          ref={patSigRef}
                          canvasProps={{ width: 256, height: 132, className: "w-full h-32" }}
                          penColor="#314D3E"
                        />
                      )}
                    </div>
                    {!isSigned && (
                      <button
                        onClick={() => patSigRef.current?.clear()}
                        className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* PDF VIEWER */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-100">
            {/* Page nav */}
            <div className="flex items-center justify-center gap-3 py-2.5 bg-white border-b border-gray-100 shrink-0">
              <button
                onClick={() => setPageNum((p) => Math.max(p - 1, 1))}
                disabled={pageNum === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-600">
                Pág. {pageNum} / {totalPages}
              </span>
              <button
                onClick={() => setPageNum((p) => Math.min(p + 1, totalPages))}
                disabled={pageNum === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Canvas + overlays */}
            <div ref={viewerRef} className="flex-1 overflow-auto flex justify-center p-4">
              <div
                ref={overlayRef}
                className="relative select-none"
                style={{ cursor: placing ? "crosshair" : "default" }}
                onClick={handleCanvasClick}
              >
                {pdfLoading && (
                  <div className="w-[520px] max-w-full h-[680px] bg-white shadow-lg rounded-sm animate-pulse" />
                )}

                {pdfError && (
                  <div className="w-[520px] max-w-full bg-white border border-red-100 shadow-lg rounded-sm p-6 text-center">
                    <p className="text-sm font-semibold text-red-500">{pdfError}</p>
                    <p className="text-xs text-gray-400 mt-1">Abra o arquivo pela Pasta Sanitária para confirmar se o PDF está válido.</p>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  className={`shadow-lg rounded-sm bg-white ${pdfLoading || pdfError ? "hidden" : "block"}`}
                />

                {/* Field overlays */}
                {!pdfLoading && !pdfError && pageFields.map((f) => {
                  const ft = FIELD_TYPES[f.type];
                  const isSig = isSigType(f.type);
                  const canvas = canvasRef.current;
                  if (!canvas) return null;
                  const left = (f.x / 100) * canvas.width;
                  const top = (f.y / 100) * canvas.height;
                  return (
                    <div
                      key={f.id}
                      className="absolute border-2 rounded flex items-center justify-center"
                      style={{
                        left,
                        top,
                        width: isSig ? 220 : 120,
                        height: isSig ? 82 : 28,
                        borderColor: ft.color,
                        backgroundColor: step === "fill" && isSig && getSignature(f.type) ? "transparent" : `${ft.color}22`,
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                      }}
                    >
                      {step === "fill" && isSig && getSignature(f.type) ? (
                        <img src={getSignature(f.type)} alt={ft.label} className="h-full w-full object-contain" />
                      ) : step === "fill" && !isSig && fieldValues[f.id] ? (
                        <span className="text-xs font-medium px-1 truncate" style={{ color: ft.color }}>
                          {fieldValues[f.id]}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1" style={{ color: ft.color }}>
                          {ft.label}
                        </span>
                      )}
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
