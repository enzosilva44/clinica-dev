import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, ChevronRight, ChevronLeft, ShieldCheck, FileText, CreditCard,
  MessageCircle, Loader2, PartyPopper,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import { LogoMark } from "../components/ui/Logo.jsx";
import { useAuth } from "../contexts/AuthContext";
import { getLeadOrigin } from "../lib/leadOrigin.js";
import api from "../services/api.js";
import { LGPD_TEXT, LGPD_TITLE, LGPD_VERSION } from "../content/legal/lgpd.js";
import { CONTRACT_TEXT, CONTRACT_TITLE, CONTRACT_VERSION } from "../content/legal/contrato.js";

const WHATSAPP_COMMERCIAL = import.meta.env.VITE_WHATSAPP_COMMERCIAL || "";

const INPUT = "w-full border border-creme-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition";
const LABEL = "text-xs font-semibold text-gray-500 mb-1.5 block";

function maskCard(v)   { return v.replace(/\D/g,"").slice(0,16).replace(/(\d{4})/g,"$1 ").trim(); }
function maskExpiry(v) { return v.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d{0,2})/,"$1/$2").replace(/\/$/,""); }
function maskCvv(v)    { return v.replace(/\D/g,"").slice(0,4); }

const STEPS = [
  { id: 1, icon: ShieldCheck, label: "LGPD" },
  { id: 2, icon: FileText,    label: "Contrato" },
  { id: 3, icon: CreditCard,  label: "Pagamento" },
];

const PLANS = [
  { id: "solo",    name: "Solo",    price: "R$ 197/mês" },
  { id: "clinica", name: "Clínica", price: "R$ 447/mês" },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              active ? "bg-verde text-white" : done ? "bg-verde/10 text-verde" : "bg-creme-100 text-gray-400"
            }`}>
              {done ? <Check size={13} /> : <s.icon size={13} />} {s.label}
            </div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${done ? "bg-verde" : "bg-creme-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// Caixa de texto legal rolável + checkbox de aceite.
function LegalStep({ title, text, checked, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-black text-[#141414] mb-1">{title}</h2>
      <p className="text-xs text-ambar font-semibold mb-4">⚠️ Rascunho — texto pendente de revisão jurídica.</p>
      <div className="border border-creme-200 rounded-xl p-4 h-64 overflow-y-auto bg-creme-50 text-sm text-gray-600 whitespace-pre-line leading-relaxed mb-4">
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

export default function Contratar() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(1);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [contractOk, setContractOk] = useState(false);
  const [plan, setPlan] = useState(user?.plan === "clinica" ? "clinica" : "solo");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const whatsappHref = WHATSAPP_COMMERCIAL
    ? `https://wa.me/${WHATSAPP_COMMERCIAL}?text=${encodeURIComponent("Olá! Estou contratando o Iasoclin e preciso de ajuda.")}`
    : null;

  function next() {
    if (step === 1 && !lgpdOk) return toast.error("Aceite os termos de LGPD para continuar.");
    if (step === 2 && !contractOk) return toast.error("Aceite o contrato para continuar.");
    setStep((s) => s + 1);
  }

  async function finalizar() {
    if (!card.number || !card.name || !card.expiry || !card.cvv) {
      return toast.error("Preencha os dados do cartão.");
    }
    setLoading(true);
    try {
      const origin = getLeadOrigin();
      const { data } = await api.post("/billing/contratar", {
        plan,
        lgpdVersion: LGPD_VERSION,
        contractVersion: CONTRACT_VERSION,
        card: {
          number: card.number.replace(/\s/g, ""),
          holderName: card.name,
          expiry: card.expiry,
          cvv: card.cvv,
        },
        acquisitionChannel: origin?.acquisitionChannel || null,
      });
      // Atualiza o usuário logado (agora conta real, plano contratado).
      if (data?.user) updateUser(data.user);
      setDone(true);
    } catch (e) {
      toast.error(mensagemDeErro(e, "concluir a contratação"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-creme-50 flex items-center justify-center px-6">
        <div className="bg-white border border-creme-100 rounded-2xl p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-verde/10 flex items-center justify-center mx-auto mb-4">
            <PartyPopper size={26} className="text-verde" />
          </div>
          <h2 className="text-2xl font-black text-[#141414] mb-2">Tudo certo!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Sua conta está ativa. Você tem 14 dias grátis — a primeira cobrança será só no 15º dia. Enviamos os detalhes por e-mail.
          </p>
          <button onClick={() => navigate("/dashboard")}
            className="bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition w-full">
            Ir para o sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme-50 font-sans text-[#1F2D2A]">
      <nav className="bg-white border-b border-creme-100">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark variant="color" size={24} />
            <span className="font-bold"><span className="text-verde">Iaso</span><span className="text-ambar">clin</span></span>
          </div>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer"
              className="text-sm text-verde font-medium hover:opacity-70 transition flex items-center gap-1.5">
              <MessageCircle size={15} /> Falar no WhatsApp
            </a>
          ) : (
            <span className="text-sm text-gray-300 flex items-center gap-1.5" title="Número comercial ainda não configurado">
              <MessageCircle size={15} /> Falar no WhatsApp
            </span>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <StepIndicator current={step} />

        <div className="bg-white border border-creme-100 rounded-2xl p-6 md:p-8">
          {step === 1 && (
            <LegalStep title={LGPD_TITLE} text={LGPD_TEXT} checked={lgpdOk} onChange={setLgpdOk} />
          )}
          {step === 2 && (
            <LegalStep title={CONTRACT_TITLE} text={CONTRACT_TEXT} checked={contractOk} onChange={setContractOk} />
          )}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-black text-[#141414] mb-4">Pagamento</h2>

              <label className={LABEL}>Plano</label>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {PLANS.map((p) => (
                  <button key={p.id} onClick={() => setPlan(p.id)}
                    className={`text-left border rounded-xl px-4 py-3 transition ${
                      plan === p.id ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                    }`}>
                    <p className="font-bold text-sm text-[#141414]">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.price}</p>
                  </button>
                ))}
              </div>

              <label className={LABEL}>Número do cartão</label>
              <input className={INPUT} inputMode="numeric" placeholder="0000 0000 0000 0000"
                value={card.number} onChange={(e) => setCard({ ...card, number: maskCard(e.target.value) })} />

              <label className={`${LABEL} mt-4`}>Nome impresso no cartão</label>
              <input className={INPUT} placeholder="Como está no cartão"
                value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })} />

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className={LABEL}>Validade</label>
                  <input className={INPUT} inputMode="numeric" placeholder="MM/AA"
                    value={card.expiry} onChange={(e) => setCard({ ...card, expiry: maskExpiry(e.target.value) })} />
                </div>
                <div>
                  <label className={LABEL}>CVV</label>
                  <input className={INPUT} inputMode="numeric" placeholder="000"
                    value={card.cvv} onChange={(e) => setCard({ ...card, cvv: maskCvv(e.target.value) })} />
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mt-4">
                14 dias grátis. A primeira cobrança acontece no 15º dia. Cancele quando quiser.
              </p>
            </div>
          )}

          {/* Navegação */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)}
                className="text-sm text-gray-500 font-medium hover:text-verde transition flex items-center gap-1">
                <ChevronLeft size={16} /> Voltar
              </button>
            ) : <span />}

            {step < 3 ? (
              <button onClick={next}
                className="bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2">
                Continuar <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={finalizar} disabled={loading}
                className="bg-verde hover:bg-verde-900 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2">
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Processando…</>) : "Concluir contratação"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
