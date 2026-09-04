import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check, ChevronRight, ChevronLeft, Eye, EyeOff,
  User, Phone, MapPin, Lock, CreditCard, ShieldCheck,
  CalendarCheck, Map, FileSignature, MessageSquare,
  Sparkles, Package, Shield, BarChart2,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import { isValidCpf, isValidCnpj } from "../lib/documentos.js";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "../components/ui/Logo.jsx";
import { PLANS as ALL_PLANS, PLANS_BY_ID, ANNUAL_DISCOUNT, BRL } from "../config/plans.js";
import { LGPD_TEXT, LGPD_TITLE, LGPD_VERSION } from "../content/legal/lgpd.js";
import { CONTRACT_TEXT, CONTRACT_TITLE, CONTRACT_VERSION } from "../content/legal/contrato.js";
import { getLeadOrigin } from "../lib/leadOrigin.js";
import api from "../services/api.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function maskCpf(v)    { return v.replace(/\D/g,"").slice(0,11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,"$1.$2.$3-$4").replace(/-$/,""); }
function maskCnpj(v)   { return v.replace(/\D/g,"").slice(0,14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,"$1.$2.$3/$4-$5").replace(/-$/,"").replace(/\/$/,""); }
function maskPhone(v)  { const d=v.replace(/\D/g,"").slice(0,11); return d.length>10?d.replace(/(\d{2})(\d{5})(\d{4})/,"($1) $2-$3"):d.replace(/(\d{2})(\d{4})(\d{0,4})/,"($1) $2-$3").replace(/-$/,""); }
function maskZip(v)    { return v.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d{0,3})/,"$1-$2").replace(/-$/,""); }

const INPUT = "w-full border border-creme-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition";
const LABEL = "text-xs font-semibold text-gray-500 mb-1.5 block";

// ── planos ────────────────────────────────────────────────────────────────────

// Derivado da fonte ÚNICA (config/plans.js). Só planos contratáveis no
// self-service (Solo, Clínica, Pro). Enterprise (sob consulta) fica de fora —
// o caminho dele é falar com a gente pelo WhatsApp na landing.
const PLANS = ALL_PLANS
  .filter((p) => p.monthly != null)
  .map((p) => ({
    id: p.id,
    name: p.name,
    price: p.priceMonthlyLabel,
    period: "/mês",
    desc: p.desc,
    features: p.features,
    highlight: p.highlight,
  }));

const PLAN_FEATURES_ICONS = [CalendarCheck, Map, FileSignature, MessageSquare, Sparkles, Package, Shield, BarChart2];

const PCT = `${Math.round(ANNUAL_DISCOUNT * 100)}%`;

// Caixa de texto legal rolável + checkbox de aceite.
function LegalBox({ title, text, checked, onChange }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-[#141414] mb-1">{title}</p>
      <p className="text-[11px] text-ambar font-semibold mb-2">⚠️ Rascunho — texto pendente de revisão jurídica.</p>
      <div className="border border-creme-200 rounded-xl p-4 h-40 overflow-y-auto bg-creme-50 text-xs text-gray-600 whitespace-pre-line leading-relaxed mb-3">
        {text}
      </div>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-verde" />
        <span className="text-sm text-gray-700">Li e concordo com {title.toLowerCase()}.</span>
      </label>
    </div>
  );
}

// ── step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: BarChart2,   label: "Plano"     },
  { id: 2, icon: CreditCard,  label: "Contrato"  },
  { id: 3, icon: User,        label: "Dados"     },
  { id: 4, icon: MapPin,      label: "Endereço"  },
  { id: 5, icon: ShieldCheck, label: "Termos"    },
  { id: 6, icon: Lock,        label: "Acesso"    },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex flex-col items-center gap-1 ${current === s.id ? "opacity-100" : current > s.id ? "opacity-70" : "opacity-30"}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition
              ${current > s.id ? "bg-verde text-white" : current === s.id ? "bg-verde text-white ring-4 ring-verde/20" : "bg-creme-100 text-gray-500"}`}>
              {current > s.id ? <Check size={14} /> : s.id}
            </div>
            <p className="text-[10px] text-gray-500 hidden sm:block">{s.label}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-1 transition ${current > s.id ? "bg-verde" : "bg-creme-100"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Signup() {
  const { registerSession, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const googleRef = useRef(null);
  const googleRenderedRef = useRef(false);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // step 1
  const [plan, setPlan] = useState("solo");

  // step 2 (contrato: modalidade + forma de entrada)
  const [modalidade, setModalidade] = useState("anual_parcelado");
  const [entrada, setEntrada]       = useState("trial");

  // step 5 (termos)
  const [lgpdOk,     setLgpdOk]     = useState(false);
  const [contractOk, setContractOk] = useState(false);

  // step 3 (dados pessoais)
  const [personType,     setPersonType]     = useState("pf");
  const [fullName,       setFullName]       = useState("");
  const [nickname,       setNickname]       = useState("");
  const [gender,         setGender]         = useState("");
  const [birthDate,      setBirthDate]      = useState("");
  const [clinicName,     setClinicName]     = useState("");
  const [specialty,      setSpecialty]      = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [phone,          setPhone]          = useState("");
  const [cpf,            setCpf]            = useState("");
  const [cnpj,           setCnpj]           = useState("");
  const [rg,             setRg]             = useState("");

  // step 4 (endereço)
  const [zipCode,       setZipCode]       = useState("");
  const [street,        setStreet]        = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement,    setComplement]    = useState("");
  const [neighborhood,  setNeighborhood]  = useState("");
  const [city,          setCity]          = useState("");
  const [state,         setState]         = useState("");
  const [zipLoading,    setZipLoading]    = useState(false);

  // step 6 (acesso)
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);

  // Google button
  useEffect(() => {
    if (step !== 6) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleRef.current || googleRenderedRef.current) return;
    function render() {
      if (!window.google?.accounts?.id || !googleRef.current) return;
      googleRenderedRef.current = true;
      googleRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (res) => {
          try { await loginWithGoogle(res.credential); }
          catch (err) { toast.error(mensagemDeErro(err, "entrar com o Google")); }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", text: "signup_with", shape: "rectangular", width: 280 });
    }
    if (window.google?.accounts?.id) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = render;
    document.body.appendChild(s);
  }, [step, loginWithGoogle]);

  async function lookupZip(raw) {
    const zip = raw.replace(/\D/g, "");
    if (zip.length !== 8) return;
    setZipLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setStreet(d.logradouro || "");
        setNeighborhood(d.bairro || "");
        setCity(d.localidade || "");
        setState(d.uf || "");
      }
    } catch { /* silencioso */ }
    finally { setZipLoading(false); }
  }

  function validateStep() {
    if (step === 3) {
      if (!fullName.trim()) { toast.error("Informe o nome completo"); return false; }
      if (!phone.trim())    { toast.error("Informe o telefone"); return false; }
      // CPF/CNPJ é obrigatório: sem ele o Asaas não emite a cobrança da
      // mensalidade — nem no fim do trial, nem na contratação direta.
      if (personType === "pj") {
        if (!cnpj.trim())      { toast.error("Informe o CNPJ"); return false; }
        if (!isValidCnpj(cnpj)) { toast.error("CNPJ inválido"); return false; }
      } else {
        if (!cpf.trim())      { toast.error("Informe o CPF"); return false; }
        if (!isValidCpf(cpf)) { toast.error("CPF inválido"); return false; }
      }
    }
    if (step === 5) {
      if (!lgpdOk)     { toast.error("Aceite os termos de LGPD para continuar."); return false; }
      if (!contractOk) { toast.error("Aceite o contrato para continuar."); return false; }
    }
    if (step === 6) {
      if (!email.trim())          { toast.error("Informe o e-mail"); return false; }
      if (password.length < 6)    { toast.error("Senha deve ter ao menos 6 caracteres"); return false; }
      if (password !== confirm)   { toast.error("As senhas não coincidem"); return false; }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Cria a conta e já contrata em seguida — o cadastro é o único caminho de
  // entrada, então tudo (plano, modalidade, aceites) é resolvido aqui.
  //
  // A ORDEM importa: /billing/contratar exige estar autenticado (usa req.user),
  // por isso a conta é criada primeiro e a sessão fica pronta antes da
  // contratação. O destino final depende da forma de entrada — trial vai ao
  // dashboard, contratação direta vai pagar.
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    try {
      await registerSession({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        nickname:       nickname.trim()              || null,
        gender:         gender                        || null,
        personType:     personType                    || "pf",
        clinicName:     clinicName.trim()             || null,
        specialty:      specialty                     || null,
        professionalId: professionalId.trim()         || null,
        birthDate:      birthDate                     || null,
        phone:          phone.replace(/\D/g, "")      || null,
        cpf:            cpf.replace(/\D/g, "")        || null,
        cnpj:           cnpj.replace(/\D/g, "")       || null,
        rg:             rg.replace(/\D/g, "")         || null,
        street: street || null,
        addressNumber: addressNumber || null,
        complement: complement || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode.replace(/\D/g, "") || null,
        plan,
      });
    } catch (err) {
      toast.error(mensagemDeErro(err, "criar a conta"));
      setLoading(false);
      return;
    }

    // Conta criada e sessão ativa. Agora a contratação.
    try {
      const origin = getLeadOrigin();
      const { data } = await api.post("/billing/contratar", {
        plan,
        modalidade,
        entrada,
        lgpdVersion: LGPD_VERSION,
        contractVersion: CONTRACT_VERSION,
        acquisitionChannel: origin?.acquisitionChannel || null,
      });

      if (data?.user) {
        localStorage.setItem("user", JSON.stringify({
          ...JSON.parse(localStorage.getItem("user") || "{}"),
          ...data.user,
        }));
      }

      if (entrada === "direto" && data?.cobranca?.invoiceUrl) {
        // Abre o checkout do Asaas e leva à tela de espera: o acesso só é
        // liberado quando o webhook confirmar o pagamento.
        window.open(data.cobranca.invoiceUrl, "_blank", "noopener");
        navigate("/pagamento-pendente");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      // A conta EXISTE e a pessoa está logada — só a contratação falhou. Mandar
      // para /contratar deixa ela concluir sem recadastrar nada.
      toast.error(mensagemDeErro(err, "concluir a contratação"));
      navigate("/contratar");
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = PLANS.find((p) => p.id === plan);
  const planoSel = PLANS_BY_ID[plan];
  const ehAnual = modalidade.startsWith("anual");
  // Valor da PRIMEIRA cobrança — o que o cliente paga agora (ou no 15º dia).
  const valorCobrado =
    modalidade === "anual_avista" ? planoSel.annualTotal
    : modalidade === "anual_parcelado" ? planoSel.annualMonthly
    : planoSel.monthly;

  return (
    <div className="min-h-screen bg-creme-50 flex flex-col items-center justify-start px-4 py-10">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <LogoMark variant="color" size={34} />
        <p className="text-2xl font-bold tracking-wide">
          <span className="text-verde">Iaso</span><span className="text-ambar">Clin</span>
        </p>
      </Link>

      <div className="w-full max-w-2xl">
        <StepIndicator current={step} />

        {/* ── STEP 1: PLANO ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-verde mb-1 text-center">Escolha seu plano</h2>
            <p className="text-sm text-gray-400 text-center mb-8">Você pode mudar de plano a qualquer momento.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`relative text-left rounded-3xl p-6 border-2 transition ${
                    plan === p.id
                      ? "border-verde bg-verde text-white shadow-xl scale-[1.02]"
                      : "border-creme-200 bg-white hover:border-verde/40"
                  }`}
                >
                  {p.highlight && (
                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full ${plan === p.id ? "bg-ambar text-white" : "bg-verde text-white"}`}>
                      MAIS POPULAR
                    </span>
                  )}
                  {plan === p.id && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-ambar flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <p className={`text-base font-bold mb-0.5 ${plan === p.id ? "text-white" : "text-verde"}`}>{p.name}</p>
                  <p className={`text-xs mb-4 ${plan === p.id ? "text-white/70" : "text-gray-400"}`}>{p.desc}</p>
                  <p className={`text-3xl font-black mb-1 ${plan === p.id ? "text-white" : "text-verde"}`}>{p.price}</p>
                  <p className={`text-xs mb-5 ${plan === p.id ? "text-white/60" : "text-gray-400"}`}>{p.period}</p>
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2 text-xs ${plan === p.id ? "text-white/80" : "text-gray-500"}`}>
                        <Check size={12} className={`mt-0.5 shrink-0 ${plan === p.id ? "text-ambar" : "text-verde"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <button onClick={next}
              className="w-full bg-verde hover:bg-verde-900 text-white py-4 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2">
              Continuar com plano {selectedPlan?.name} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── STEP 2: CONTRATO (modalidade + forma de entrada) ──────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-3xl border border-creme-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-verde mb-1">Como você quer pagar</h2>
            <p className="text-xs text-gray-400 mb-6">
              Plano <strong>{planoSel.name}</strong>. Você paga na página segura do
              Asaas — por PIX, cartão ou boleto.
            </p>

            <label className={LABEL}>Forma de pagamento</label>
            <div className="space-y-3 mb-6">
              <button onClick={() => setModalidade("anual_parcelado")}
                className={`w-full text-left border rounded-xl px-5 py-4 transition relative ${
                  modalidade === "anual_parcelado" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                }`}>
                <span className="absolute top-3 right-3 text-[10px] font-bold text-white bg-ambar px-2 py-0.5 rounded-full">
                  -{PCT} · recomendado
                </span>
                <p className="font-bold text-sm text-[#141414] mb-1">
                  Anual parcelado — {BRL(planoSel.annualMonthly)}/mês
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Você fecha 12 meses mas paga <strong>uma parcela por mês</strong>,
                  sem comprometer o limite do cartão de uma vez.
                  {" "}<strong>Preço garantido</strong> durante todo o período.
                </p>
              </button>

              <button onClick={() => setModalidade("anual_avista")}
                className={`w-full text-left border rounded-xl px-5 py-4 transition relative ${
                  modalidade === "anual_avista" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                }`}>
                <span className="absolute top-3 right-3 text-[10px] font-bold text-white bg-ambar px-2 py-0.5 rounded-full">
                  -{PCT}
                </span>
                <p className="font-bold text-sm text-[#141414] mb-1">
                  Anual à vista — {BRL(planoSel.annualTotal)}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Paga o ano inteiro de uma vez e economiza{" "}
                  <strong>{BRL(planoSel.savings)}</strong>.
                  {" "}<strong>Preço garantido</strong> durante todo o período.
                </p>
              </button>

              <button onClick={() => setModalidade("mensal")}
                className={`w-full text-left border rounded-xl px-5 py-4 transition ${
                  modalidade === "mensal" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                }`}>
                <p className="font-bold text-sm text-[#141414] mb-1">
                  Mensal — {planoSel.priceMonthlyLabel}/mês
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Sem compromisso, cancele quando quiser. O valor
                  {" "}<strong>não fica travado</strong> e está sujeito a reajuste.
                </p>
              </button>
            </div>

            {ehAnual && (
              <p className="text-[11px] text-gray-400 -mt-3 mb-5 leading-relaxed">
                Ao contratar uma modalidade anual você garante o preço por 12 meses.
                Em caso de cancelamento antes do prazo, os meses já usados passam a
                valer o preço mensal cheio ({planoSel.priceMonthlyLabel}) e a
                diferença é cobrada.
              </p>
            )}

            <label className={LABEL}>Como quer começar</label>
            <div className="space-y-3">
              <button onClick={() => setEntrada("trial")}
                className={`w-full text-left border rounded-xl px-5 py-4 transition ${
                  entrada === "trial" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                }`}>
                <p className="font-bold text-sm text-verde mb-1">Testar 14 dias grátis</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Acesso liberado <strong>assim que terminar o cadastro</strong>. A
                  primeira cobrança de <strong>{BRL(valorCobrado)}</strong> acontece
                  só no <strong>15º dia</strong>.
                </p>
              </button>

              <button onClick={() => setEntrada("direto")}
                className={`w-full text-left border rounded-xl px-5 py-4 transition ${
                  entrada === "direto" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                }`}>
                <p className="font-bold text-sm text-verde mb-1">
                  Contratar agora — {BRL(valorCobrado)}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Sem período de teste. Geramos a cobrança ao final do cadastro e o
                  acesso é liberado <strong>assim que o pagamento for confirmado</strong>.
                </p>
              </button>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={back}
                className="flex-1 border border-creme-200 py-3 rounded-xl text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2">
                <ChevronLeft size={16} /> Voltar
              </button>
              <button onClick={next}
                className="flex-1 bg-verde hover:bg-verde-900 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DADOS PESSOAIS ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-3xl border border-creme-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-verde mb-1">Dados pessoais e da clínica</h2>
            <p className="text-xs text-gray-400 mb-6">Informações do responsável e da clínica.</p>

            <div className="space-y-5">

              {/* Tipo de pessoa */}
              <div>
                <label className={LABEL}>Tipo de cadastro *</label>
                <div className="flex gap-3">
                  {[{ value: "pf", label: "Pessoa Física", sub: "CPF" }, { value: "pj", label: "Pessoa Jurídica", sub: "CNPJ" }].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setPersonType(opt.value)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                        personType === opt.value ? "border-verde bg-verde text-white" : "border-creme-200 text-gray-600 hover:border-verde/40"}`}>
                      {opt.label}
                      <span className={`block text-xs font-normal mt-0.5 ${personType === opt.value ? "text-white/60" : "text-gray-400"}`}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título / gênero */}
              <div>
                <label className={LABEL}>Título profissional</label>
                <div className="flex gap-3">
                  {[{ value: "F", label: "Dra.", desc: "Feminino" }, { value: "M", label: "Dr.", desc: "Masculino" }].map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setGender(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                        gender === opt.value ? "border-verde bg-verde text-white" : "border-creme-200 text-gray-600 hover:border-verde/40"}`}>
                      {gender === opt.value && <Check size={14} />}
                      {opt.label} <span className={`text-xs font-normal ${gender === opt.value ? "text-white/70" : "text-gray-400"}`}>({opt.desc})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome + apelido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>{personType === "pj" ? "Razão social *" : "Nome completo *"}</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder={personType === "pj" ? "Clínica Exemplo Ltda." : "Ana Carolina Silva"} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Como quer ser chamado(a)</label>
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                    placeholder="Dra. Ana" className={INPUT} />
                </div>
              </div>

              {/* Data de nascimento + telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>{personType === "pj" ? "Data de fundação" : "Data de nascimento"}</label>
                  <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Telefone / WhatsApp *</label>
                  <input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(11) 99999-9999" inputMode="numeric" className={INPUT} />
                </div>
              </div>

              {/* CPF/RG ou CNPJ */}
              {personType === "pf" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>CPF *</label>
                    <input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))}
                      placeholder="000.000.000-00" inputMode="numeric" className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>RG</label>
                    <input value={rg} onChange={(e) => setRg(e.target.value.replace(/\D/g,"").slice(0,9))}
                      placeholder="000000000" inputMode="numeric" className={INPUT} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className={LABEL}>CNPJ *</label>
                  <input value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00" inputMode="numeric" className={INPUT} />
                </div>
              )}

              {/* Nome da clínica */}
              <div>
                <label className={LABEL}>Nome da clínica / nome fantasia</label>
                <input value={clinicName} onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Ex: Clínica Bella Vita" className={INPUT} />
              </div>

              {/* Especialidade + registro profissional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Especialidade</label>
                  <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={INPUT}>
                    <option value="">Selecione...</option>
                    <option>Estética</option>
                    <option>Dermatologia</option>
                    <option>Odontologia</option>
                    <option>Biomedicina</option>
                    <option>Enfermagem Estética</option>
                    <option>Nutrição</option>
                    <option>Fisioterapia</option>
                    <option>Medicina</option>
                    <option>Outro</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Registro profissional (CRM, CRO, CRBio...)</label>
                  <input value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}
                    placeholder="CRM-SP 123456" className={INPUT} />
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={back}
                className="flex-1 border border-creme-200 py-3 rounded-xl text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2">
                <ChevronLeft size={16} /> Voltar
              </button>
              <button onClick={next}
                className="flex-1 bg-verde hover:bg-verde-900 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: ENDEREÇO ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="bg-white rounded-3xl border border-creme-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-verde mb-1">Endereço</h2>
            <p className="text-xs text-gray-400 mb-6">Endereço da clínica ou responsável.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>CEP</label>
                  <input value={zipCode}
                    onChange={(e) => {
                      const v = maskZip(e.target.value);
                      setZipCode(v);
                      if (v.replace(/\D/g,"").length === 8) lookupZip(v);
                    }}
                    placeholder="00000-000" inputMode="numeric"
                    className={INPUT + (zipLoading ? " opacity-60" : "")} />
                </div>
                <div>
                  <label className={LABEL}>Estado</label>
                  <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0,2))}
                    placeholder="SP" maxLength={2} className={INPUT} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Rua / Logradouro</label>
                <input value={street} onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua das Flores" className={INPUT} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Número</label>
                  <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="123" className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Complemento</label>
                  <input value={complement} onChange={(e) => setComplement(e.target.value)}
                    placeholder="Sala 201, Apto 4..." className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Bairro</label>
                  <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Centro" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Cidade</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="São Paulo" className={INPUT} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={back}
                className="flex-1 border border-creme-200 py-3 rounded-xl text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2">
                <ChevronLeft size={16} /> Voltar
              </button>
              <button onClick={next}
                className="flex-1 bg-verde hover:bg-verde-900 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: TERMOS (LGPD + contrato) ──────────────────────────────── */}
        {step === 5 && (
          <div className="bg-white rounded-3xl border border-creme-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-verde mb-1">Termos e contrato</h2>
            <p className="text-xs text-gray-400 mb-6">
              Leia e aceite para concluir a contratação do plano{" "}
              <strong>{planoSel.name}</strong>.
            </p>

            <LegalBox title={LGPD_TITLE} text={LGPD_TEXT} checked={lgpdOk} onChange={setLgpdOk} />
            <LegalBox title={CONTRACT_TITLE} text={CONTRACT_TEXT} checked={contractOk} onChange={setContractOk} />

            <div className="flex gap-3 mt-6">
              <button onClick={back}
                className="flex-1 border border-creme-200 py-3 rounded-xl text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2">
                <ChevronLeft size={16} /> Voltar
              </button>
              <button onClick={next}
                className="flex-1 bg-verde hover:bg-verde-900 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 6: ACESSO ────────────────────────────────────────────────── */}
        {step === 6 && (
          <div className="bg-white rounded-3xl border border-creme-100 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-verde mb-1">Criar acesso</h2>
            <p className="text-xs text-gray-400 mb-6">Configure seu e-mail e senha para entrar no sistema.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={LABEL}>E-mail *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" autoCapitalize="none" inputMode="email" required className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Senha *</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required className={INPUT + " pr-11"} />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={LABEL}>Confirmar senha *</label>
                <input type={showPass ? "text" : "password"} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha" required className={INPUT} />
              </div>

              {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="h-px bg-creme-100 flex-1" />
                    <span className="text-xs text-gray-400">ou cadastre com</span>
                    <div className="h-px bg-creme-100 flex-1" />
                  </div>
                  <div className="flex justify-center">
                    <div ref={googleRef} />
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={back}
                  className="flex-1 border border-creme-200 py-3 rounded-xl text-sm hover:bg-creme-50 transition flex items-center justify-center gap-2">
                  <ChevronLeft size={16} /> Voltar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-verde hover:bg-verde-900 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                  {loading
                    ? "Criando conta…"
                    : entrada === "direto"
                      ? <><Check size={15} /> Criar conta e pagar</>
                      : <><Check size={15} /> Criar conta e começar</>}
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-sm text-gray-400 mt-6">
          Já tem conta?{" "}
          <Link to="/" className="text-verde font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
