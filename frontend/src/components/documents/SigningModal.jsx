import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import SignatureCanvas from "react-signature-canvas";
import { X, ChevronLeft, ChevronRight, Shield, Mail, Phone, CheckCircle, Download, RefreshCw, Loader2, Trash2, Check, FlaskConical } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useFeatures } from "../../hooks/useFeatures";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const STEPS = [
  { id: "signer",    label: "Identificação" },
  { id: "preview",   label: "Leitura" },
  { id: "accept",    label: "Aceite" },
  { id: "otp-send",  label: "Validação" },
  { id: "otp-code",  label: "Código" },
  { id: "signature", label: "Assinatura" },
  { id: "sign",      label: "Confirmar" },
];

function StepIndicator({ current }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
            i < idx ? "bg-[#00704A] text-white" :
            i === idx ? "bg-[#00704A] text-white ring-4 ring-[#00704A]/20" :
            "bg-[#E6E2D8] text-gray-400"
          }`}>
            {i < idx ? <CheckCircle size={14} /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 transition-all ${i < idx ? "bg-[#00704A]" : "bg-[#E6E2D8]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PdfViewer({ docId }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/documents/${docId}/file?token=${encodeURIComponent(token ?? "")}`;
    pdfjsLib.getDocument({ url }).promise
      .then((doc) => { setPdfDoc(doc); setTotalPages(doc.numPages); })
      .catch(() => setError("Não foi possível carregar o PDF."))
      .finally(() => setLoading(false));
  }, [docId]);

  const renderPage = useCallback(async (num) => {
    if (!pdfDoc || !canvasRef.current) return;
    renderTaskRef.current?.cancel();
    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const viewerWidth = viewerRef.current?.clientWidth ?? 600;
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min((viewerWidth - 32) / vp.width, 1.5);
      const sv = page.getViewport({ scale });
      canvas.width = Math.floor(sv.width);
      canvas.height = Math.floor(sv.height);
      canvas.style.width = `${Math.floor(sv.width)}px`;
      canvas.style.height = `${Math.floor(sv.height)}px`;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport: sv });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (e) {
      if (e?.name === "RenderingCancelledException") return;
    }
  }, [pdfDoc]);

  useEffect(() => { renderPage(pageNum); }, [pdfDoc, pageNum, renderPage]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-3 py-2 border-b border-gray-100 shrink-0">
        <button onClick={() => setPageNum((p) => Math.max(p - 1, 1))} disabled={pageNum === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-500">Pág. {pageNum} / {totalPages}</span>
        <button onClick={() => setPageNum((p) => Math.min(p + 1, totalPages))} disabled={pageNum === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
      <div ref={viewerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-gray-50">
        {loading && <div className="w-full max-w-lg h-125 bg-white rounded animate-pulse" />}
        {error  && <p className="text-sm text-red-500 mt-8">{error}</p>}
        <canvas ref={canvasRef} className={`shadow-md rounded bg-white ${loading || error ? "hidden" : ""}`} />
      </div>
    </div>
  );
}

export default function SigningModal({ patientDoc, patient, onClose, onSigned }) {
  const features = useFeatures();
  const [step, setStep] = useState("signer");

  // Dados do assinante
  const [signerName,  setSignerName]  = useState(patientDoc.signerName  ?? patient?.name  ?? "");
  const [signerCpf,   setSignerCpf]   = useState(patientDoc.signerCpf   ?? patient?.cpf   ?? patient?.document ?? "");
  const [signerEmail, setSignerEmail] = useState(patientDoc.signerEmail  ?? patient?.email ?? "");
  const [signerPhone, setSignerPhone] = useState(patientDoc.signerPhone  ?? patient?.phone ?? "");

  // Aceite
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState(null);

  // Geolocalização
  const [geoConsent, setGeoConsent] = useState(false);
  const [geoData, setGeoData] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | requesting | granted | denied

  // OTP
  const [otpMethod, setOtpMethod] = useState("email");
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedTarget, setMaskedTarget] = useState("");
  const [otpTestCode, setOtpTestCode] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpValidating, setOtpValidating] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);

  // Assinaturas manuscritas
  const patSigRef  = useRef(null);
  const proSigRef  = useRef(null);
  const [patSigEmpty,  setPatSigEmpty]  = useState(true);
  const [proSigEmpty,  setProSigEmpty]  = useState(true);
  const [patSigDataUrl, setPatSigDataUrl] = useState(null);
  const [proSigDataUrl, setProSigDataUrl] = useState(null);

  const needsProSig = (patientDoc.document.fields ?? []).some((f) => f.type === "professional_sig");

  const [saving, setSaving] = useState(false);
  const [signedDoc, setSignedDoc] = useState(null);

  // Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function startTimer() {
    setOtpTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  function requestGeo() {
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoData({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 }
    );
  }

  async function handleSendOtp() {
    const target = otpMethod === "email" ? signerEmail : signerPhone;
    if (!target) { toast.error(`Informe o ${otpMethod === "email" ? "e-mail" : "telefone"}`); return; }
    setOtpSending(true);
    try {
      const res = await api.post(`/documents/patient-doc/${patientDoc.id}/request-otp`, {
        method: otpMethod,
        email: otpMethod === "email" ? signerEmail : undefined,
        phone: otpMethod !== "email"  ? signerPhone : undefined,
      });
      setMaskedTarget(res.data.maskedTarget);
      setOtpTestCode(res.data.testCode ?? null);
      if (res.data.testCode) setOtpCode(res.data.testCode);
      setOtpSent(true);
      startTimer();
      setStep("otp-code");
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao enviar código");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleValidateOtp() {
    if (otpCode.length !== 6) { toast.error("Código deve ter 6 dígitos"); return; }
    setOtpValidating(true);
    try {
      await api.post(`/documents/patient-doc/${patientDoc.id}/validate-otp`, { code: otpCode });
      setStep("signature");
    } catch (e) {
      toast.error(e.response?.data?.error || "Código inválido");
    } finally {
      setOtpValidating(false);
    }
  }

  async function handleSign() {
    if (!patSigDataUrl) { toast.error("A assinatura do paciente é obrigatória"); return; }
    if (needsProSig && !proSigDataUrl) { toast.error("A assinatura do profissional é obrigatória"); return; }
    const patSig = patSigDataUrl;
    const proSig = proSigDataUrl ?? null;

    setSaving(true);
    try {
      const res = await api.put(`/documents/patient-doc/${patientDoc.id}/sign`, {
        signerName:        signerName.trim(),
        signerCpf:         signerCpf.trim(),
        signerEmail:       signerEmail.trim(),
        signerPhone:       signerPhone.trim(),
        signerTimezone:    timezone,
        acceptedTerms:     true,
        acceptedAt:        acceptedAt,
        latitude:          geoData?.latitude  ?? null,
        longitude:         geoData?.longitude ?? null,
        geolocationConsent: geoStatus !== "idle",
        fieldValues:       patientDoc.fieldValues ?? {},
        professionalSignature: proSig,
        patientSignature:  patSig,
      });
      setSignedDoc(res.data);
      toast.success("Documento assinado com sucesso!");
      onSigned?.();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao assinar documento");
    } finally {
      setSaving(false);
    }
  }

  function downloadSigned() {
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/documents/patient-doc/${patientDoc.id}/file?token=${encodeURIComponent(token ?? "")}`;
    window.open(url, "_blank");
  }

  const canGoToPreview = signerName.trim() && signerCpf.trim() && signerEmail.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#00704A]" />
            <h2 className="text-sm font-bold text-[#00704A]">Assinatura Eletrônica</h2>
            <span className="text-xs text-gray-400 hidden sm:block">— {patientDoc.document.name}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator current={step} />

          {/* ── ETAPA 1: Identificação ── */}
          {step === "signer" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Identificação do Assinante</h3>
                <p className="text-xs text-gray-400">Confirme os dados que serão registrados na auditoria.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Nome completo *", value: signerName, onChange: setSignerName, placeholder: "Nome completo" },
                  { label: "CPF *", value: signerCpf, onChange: setSignerCpf, placeholder: "000.000.000-00" },
                  { label: "E-mail *", value: signerEmail, onChange: setSignerEmail, placeholder: "email@exemplo.com", type: "email" },
                  { label: "Telefone celular", value: signerPhone, onChange: setSignerPhone, placeholder: "(11) 99999-9999", type: "tel" },
                ].map(({ label, value, onChange, placeholder, type = "text" }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                    <input
                      type={type}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      placeholder={placeholder}
                      className="w-full border border-[#CBA258] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep("preview")}
                disabled={!canGoToPreview}
                className="w-full bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition mt-2"
              >
                Prosseguir para leitura do documento →
              </button>
            </div>
          )}

          {/* ── ETAPA 2: Preview do PDF ── */}
          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Leia o Documento</h3>
                <p className="text-xs text-gray-400">Role até o fim antes de prosseguir.</p>
              </div>
              <div className="border border-[#DDD8CC] rounded-2xl overflow-hidden h-105">
                <PdfViewer docId={patientDoc.document.id} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("signer")}
                  className="flex-1 border border-[#CBA258] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  ← Voltar
                </button>
                <button onClick={() => setStep("accept")}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] text-white py-2.5 rounded-xl text-sm font-semibold transition">
                  Li o documento →
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Aceite + Geolocalização ── */}
          {step === "accept" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Declaração de Aceite</h3>
                <p className="text-xs text-gray-400">Confirme que leu e concorda com o conteúdo do documento.</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border-2 transition"
                style={{ borderColor: accepted ? "#00704A" : "#DDD8CC", backgroundColor: accepted ? "#F0F7F5" : "#FAFAF8" }}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked);
                    if (e.target.checked) setAcceptedAt(new Date().toISOString());
                  }}
                  className="mt-0.5 accent-[#00704A] w-4 h-4 shrink-0"
                />
                <span className="text-sm text-gray-700 leading-relaxed">
                  <strong>Declaro que li e concordo</strong> com o conteúdo do documento <em>"{patientDoc.document.name}"</em>, e autorizo sua assinatura eletrônica em meu nome.
                </span>
              </label>

              {/* Geolocalização */}
              <div className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl p-4">
                <p className="text-xs font-semibold text-[#00704A] mb-2">Geolocalização (opcional)</p>
                <p className="text-xs text-gray-500 mb-3">Registrar sua localização aumenta a validade jurídica do documento. Você pode recusar.</p>
                {geoStatus === "idle" && (
                  <div className="flex gap-2">
                    <button onClick={() => { setGeoConsent(true); requestGeo(); }}
                      className="flex-1 bg-[#00704A] text-white text-xs py-2 rounded-lg transition hover:bg-[#1E3932]">
                      Permitir localização
                    </button>
                    <button onClick={() => { setGeoConsent(false); setGeoStatus("denied"); }}
                      className="flex-1 border border-[#CBA258] text-xs py-2 rounded-lg transition hover:bg-[#E6E2D8]">
                      Recusar
                    </button>
                  </div>
                )}
                {geoStatus === "requesting" && <p className="text-xs text-gray-400 animate-pulse">Aguardando permissão…</p>}
                {geoStatus === "granted"  && <p className="text-xs text-green-600 flex items-center gap-1"><Check size={11} /> Localização registrada</p>}
                {geoStatus === "denied"   && <p className="text-xs text-gray-400">Localização recusada — GEOLOCATION_DENIED registrado</p>}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("preview")}
                  className="flex-1 border border-[#CBA258] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  ← Voltar
                </button>
                <button
                  onClick={() => setStep("otp-send")}
                  disabled={!accepted || geoStatus === "requesting"}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition"
                >
                  Prosseguir para validação →
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: Escolha do método OTP ── */}
          {step === "otp-send" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Validação de Identidade</h3>
                <p className="text-xs text-gray-400">Enviaremos um código de 6 dígitos para confirmar sua identidade.</p>
              </div>

              <div className="space-y-2">
                {[
                  { method: "email", icon: Mail, label: "E-mail", target: signerEmail, available: !!signerEmail },
                  { method: "sms", icon: Phone, label: "SMS", target: signerPhone, available: false, badge: "Em breve" },
                  ...(features.whatsapp
                    ? [{ method: "whatsapp", icon: Phone, label: "WhatsApp", target: signerPhone, available: !!signerPhone }]
                    : []),
                ].map(({ method, icon: Icon, label, target, available, badge }) => (
                  <button
                    key={method}
                    onClick={() => available && setOtpMethod(method)}
                    disabled={!available}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left ${
                      otpMethod === method && available
                        ? "border-[#00704A] bg-[#F0F7F5]"
                        : available
                        ? "border-[#DDD8CC] hover:border-[#00704A]/40"
                        : "border-[#DDD8CC] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#E6E2D8] flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#00704A]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#00704A]">{label}</p>
                      <p className="text-xs text-gray-400">{available ? target : (badge ?? "Não disponível")}</p>
                    </div>
                    {otpMethod === method && available && <CheckCircle size={16} className="text-[#00704A] shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("accept")}
                  className="flex-1 border border-[#CBA258] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  ← Voltar
                </button>
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  {otpSending ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : "Enviar código →"}
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 5: Input do código OTP ── */}
          {step === "otp-code" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Digite o Código</h3>
                <p className="text-xs text-gray-400">
                  {otpTestCode
                    ? "Modo teste ativo — o código foi gerado abaixo."
                    : <>Código enviado para <strong>{maskedTarget}</strong>. Expira em 10 minutos.</>}
                </p>
              </div>

              {otpTestCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <FlaskConical size={18} className="text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Modo Teste</p>
                    <p className="text-xs text-amber-600">Código: <strong className="tracking-widest">{otpTestCode}</strong></p>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-4xl font-bold tracking-[12px] text-center border-2 border-[#CBA258] rounded-2xl px-6 py-4 w-56 focus:outline-none focus:border-[#00704A]"
                  autoFocus
                />
              </div>

              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-xs text-gray-400">Reenviar em {otpTimer}s</p>
                ) : (
                  <button
                    onClick={() => { setOtpCode(""); setOtpSent(false); setStep("otp-send"); }}
                    className="text-xs text-[#00704A] hover:underline flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw size={12} /> Reenviar código
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("otp-send")}
                  className="flex-1 border border-[#CBA258] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  ← Voltar
                </button>
                <button
                  onClick={handleValidateOtp}
                  disabled={otpCode.length !== 6 || otpValidating}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  {otpValidating ? <><Loader2 size={14} className="animate-spin" /> Validando…</> : "Validar código →"}
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 6: Assinaturas manuscritas ── */}
          {step === "signature" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Assinaturas</h3>
                <p className="text-xs text-gray-400">Assine com o dedo ou mouse nos campos abaixo.</p>
              </div>

              {/* Assinatura do Paciente */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-[#00704A]">Assinatura do Paciente <span className="text-red-400">*</span></p>
                  <button onClick={() => { patSigRef.current?.clear(); setPatSigEmpty(true); }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition">
                    <Trash2 size={12} /> Limpar
                  </button>
                </div>
                <div className="border-2 rounded-2xl overflow-hidden bg-gray-50"
                  style={{ borderColor: patSigEmpty ? "#DDD8CC" : "#00704A" }}>
                  <SignatureCanvas
                    ref={patSigRef}
                    penColor="#00704A"
                    canvasProps={{ className: "w-full", height: 150 }}
                    onEnd={() => setPatSigEmpty(patSigRef.current?.isEmpty() ?? true)}
                  />
                </div>
                <p className="text-xs mt-1">
                  {patSigEmpty
                    ? <span className="text-gray-400">Aguardando assinatura…</span>
                    : <span className="text-green-600 font-medium inline-flex items-center gap-1"><Check size={11} /> Registrada</span>}
                </p>
              </div>

              {/* Assinatura do Profissional — só se o documento tiver campo professional_sig */}
              {needsProSig && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-[#6F7F73]">Assinatura do Profissional <span className="text-red-400">*</span></p>
                    <button onClick={() => { proSigRef.current?.clear(); setProSigEmpty(true); }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition">
                      <Trash2 size={12} /> Limpar
                    </button>
                  </div>
                  <div className="border-2 rounded-2xl overflow-hidden bg-gray-50"
                    style={{ borderColor: proSigEmpty ? "#DDD8CC" : "#6F7F73" }}>
                    <SignatureCanvas
                      ref={proSigRef}
                      penColor="#6F7F73"
                      canvasProps={{ className: "w-full", height: 150 }}
                      onEnd={() => setProSigEmpty(proSigRef.current?.isEmpty() ?? true)}
                    />
                  </div>
                  <p className="text-xs mt-1">
                    {proSigEmpty
                      ? <span className="text-gray-400">Aguardando assinatura…</span>
                      : <span className="text-green-600 font-medium inline-flex items-center gap-1"><Check size={11} /> Registrada</span>}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep("otp-code")}
                  className="flex-1 border border-[#CBA258] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  ← Voltar
                </button>
                <button
                  disabled={patSigEmpty || (needsProSig && proSigEmpty)}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition"
                  onClick={() => {
                    setPatSigDataUrl(patSigRef.current?.toDataURL());
                    if (needsProSig) setProSigDataUrl(proSigRef.current?.toDataURL());
                    setStep("sign");
                  }}
                >
                  Confirmar assinaturas →
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 7: Confirmar e assinar ── */}
          {step === "sign" && !signedDoc && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#00704A] mb-1">Confirmar Assinatura</h3>
                <p className="text-xs text-gray-400">Identidade verificada. Clique para assinar e gerar o PDF com certificado de evidências.</p>
              </div>

              <div className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 text-xs">Documento</span><span className="font-medium text-[#00704A] text-xs">{patientDoc.document.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-xs">Assinante</span><span className="font-medium text-[#00704A] text-xs">{signerName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-xs">CPF</span><span className="font-medium text-[#00704A] text-xs">{signerCpf}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-xs">E-mail</span><span className="font-medium text-[#00704A] text-xs">{signerEmail}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-xs">Validação OTP</span><span className="font-medium text-green-600 text-xs inline-flex items-center gap-1"><Check size={10} /> {otpMethod}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-xs">Assinatura do paciente</span><span className="font-medium text-green-600 text-xs inline-flex items-center gap-1"><Check size={10} /> Registrada</span></div>
                {needsProSig && <div className="flex justify-between"><span className="text-gray-500 text-xs">Assinatura do profissional</span><span className="font-medium text-green-600 text-xs inline-flex items-center gap-1"><Check size={10} /> Registrada</span></div>}
                <div className="flex justify-between"><span className="text-gray-500 text-xs">Fuso horário</span><span className="font-medium text-[#00704A] text-xs">{timezone}</span></div>
                {geoData && <div className="flex justify-between"><span className="text-gray-500 text-xs">Localização</span><span className="font-medium text-[#00704A] text-xs inline-flex items-center gap-1"><Check size={10} /> Registrada</span></div>}
              </div>

              <button
                onClick={handleSign}
                disabled={saving}
                className="w-full bg-[#00704A] hover:bg-[#1E3932] disabled:opacity-50 text-white py-3.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Gerando PDF e certificado…</>
                  : <><Shield size={16} /> Assinar documento</>
                }
              </button>
            </div>
          )}

          {/* ── SUCESSO ── */}
          {signedDoc && (
            <div className="flex flex-col items-center text-center gap-5 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#00704A]">Documento Assinado!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  O PDF com o certificado de evidências foi gerado e armazenado com segurança.
                </p>
              </div>
              <div className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl p-4 w-full text-left space-y-1.5">
                <p className="text-xs text-gray-500">Hash SHA-256: <span className="font-mono text-[10px] text-[#00704A] break-all">{signedDoc.signedHash}</span></p>
                <p className="text-xs text-gray-500">Assinado em: <span className="font-medium text-[#00704A]">{new Date(signedDoc.signedAt).toLocaleString("pt-BR")}</span></p>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={downloadSigned}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#00704A] hover:bg-[#1E3932] text-white py-3 rounded-xl text-sm font-semibold transition">
                  <Download size={15} /> Baixar PDF Assinado
                </button>
                <button onClick={onClose}
                  className="flex-1 border border-[#CBA258] py-3 rounded-xl text-sm hover:bg-[#E6E2D8] transition">
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
