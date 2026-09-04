import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, ChevronRight, ChevronLeft, ShieldCheck, FileText, CreditCard,
  MessageCircle, Loader2, PartyPopper,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import { LogoMark } from "../components/ui/Logo.jsx";
import { PLANS_BY_ID, ANNUAL_DISCOUNT, BRL } from "../config/plans.js";
import { useAuth } from "../contexts/AuthContext";
import { getLeadOrigin } from "../lib/leadOrigin.js";
import api from "../services/api.js";
import { LGPD_TEXT, LGPD_TITLE, LGPD_VERSION } from "../content/legal/lgpd.js";
import { CONTRACT_TEXT, CONTRACT_TITLE, CONTRACT_VERSION } from "../content/legal/contrato.js";

import { whatsappHref as montaWhatsapp } from "../config/contato.js";

const LABEL = "text-xs font-semibold text-gray-500 mb-1.5 block";
const PCT = `${Math.round(ANNUAL_DISCOUNT * 100)}%`;

const STEPS = [
  { id: 1, icon: ShieldCheck, label: "LGPD" },
  { id: 2, icon: FileText,    label: "Contrato" },
  { id: 3, icon: CreditCard,  label: "Pagamento" },
];

const PLAN_IDS = ["solo", "clinica", "pro"];

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
  // anual_parcelado | anual_avista | mensal
  const [modalidade, setModalidade] = useState("anual_parcelado");
  const [entrada, setEntrada] = useState("trial");  // trial | direto
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cobranca, setCobranca] = useState(null);   // link do checkout Asaas

  const planoSel = PLANS_BY_ID[plan];
  const ehAnual = modalidade.startsWith("anual");
  // Valor da PRIMEIRA cobrança — é o que o cliente paga agora (ou no 15º dia).
  const valorCobrado =
    modalidade === "anual_avista" ? planoSel.annualTotal
    : modalidade === "anual_parcelado" ? planoSel.annualMonthly
    : planoSel.monthly;

  // No trial a conta já está ativa: mostra o sucesso por ~2,5s e leva ao
  // sistema sozinho. Na contratação direta NÃO redireciona — o acesso só abre
  // depois do pagamento, e o dashboard responderia 403.
  useEffect(() => {
    if (!done || entrada !== "trial") return;
    const t = setTimeout(() => navigate("/dashboard"), 2500);
    return () => clearTimeout(t);
  }, [done, entrada, navigate]);

  const whatsappHref = montaWhatsapp("Olá! Estou contratando o Iasoclin e preciso de ajuda.");

  function next() {
    if (step === 1 && !lgpdOk) return toast.error("Aceite os termos de LGPD para continuar.");
    if (step === 2 && !contractOk) return toast.error("Aceite o contrato para continuar.");
    setStep((s) => s + 1);
  }

  async function finalizar() {
    setLoading(true);
    try {
      const origin = getLeadOrigin();
      const { data } = await api.post("/billing/contratar", {
        plan,
        modalidade,
        entrada,
        lgpdVersion: LGPD_VERSION,
        contractVersion: CONTRACT_VERSION,
        // Sem cartão: backend abre a assinatura como UNDEFINED e o cliente
        // escolhe PIX/cartão/boleto no checkout do Asaas.
        acquisitionChannel: origin?.acquisitionChannel || null,
      });
      // Atualiza o usuário logado (agora conta real, plano contratado).
      if (data?.user) updateUser(data.user);
      if (data?.cobranca) setCobranca(data.cobranca);
      setDone(true);
    } catch (e) {
      toast.error(mensagemDeErro(e, "concluir a contratação"));
    } finally {
      setLoading(false);
    }
  }

  // Contratação direta: o acesso só abre com o pagamento confirmado, então a
  // tela final é o checkout — não uma comemoração.
  if (done && entrada === "direto") {
    return (
      <div className="min-h-screen bg-creme-50 flex items-center justify-center px-6">
        <div className="bg-white border border-creme-100 rounded-2xl p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-ambar/15 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={26} className="text-ambar" />
          </div>
          <h2 className="text-2xl font-black text-[#141414] mb-2">Falta só o pagamento</h2>
          <p className="text-gray-500 text-sm mb-6">
            Sua conta foi criada. Assim que o pagamento de{" "}
            <strong>{BRL(cobranca?.value ?? valorCobrado)}</strong> for confirmado, o
            acesso é liberado automaticamente e você recebe um e-mail.
          </p>

          {cobranca?.invoiceUrl ? (
            <a href={cobranca.invoiceUrl} target="_blank" rel="noreferrer"
              className="bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition w-full flex items-center justify-center gap-2">
              Pagar agora <ChevronRight size={16} />
            </a>
          ) : (
            <p className="text-sm text-ambar font-semibold">
              Não conseguimos gerar o link de pagamento. Fale com a gente pelo WhatsApp.
            </p>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            Pagamento por PIX, cartão ou boleto na página segura do Asaas.
            {" "}PIX cai na hora; boleto pode levar até 3 dias úteis.
          </p>

          <button onClick={() => navigate("/login")}
            className="text-xs text-gray-400 hover:text-verde transition mt-4">
            Já paguei — entrar no sistema
          </button>
        </div>
      </div>
    );
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
            Sua conta está ativa. Você tem 14 dias grátis — a primeira cobrança de{" "}
            <strong>{BRL(valorCobrado)}</strong> será só no 15º dia. Enviamos os
            detalhes por e-mail.
          </p>
          <button onClick={() => navigate("/dashboard")}
            className="bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition w-full">
            Ir para o sistema
          </button>
          <p className="text-[11px] text-gray-400 mt-3">Você será redirecionado automaticamente…</p>
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
                {PLAN_IDS.map((id) => {
                  const p = PLANS_BY_ID[id];
                  const preco = ehAnual
                    ? `${BRL(p.annualMonthly)}/mês`
                    : `${p.priceMonthlyLabel}/mês`;
                  return (
                    <button key={id} onClick={() => setPlan(id)}
                      className={`text-left border rounded-xl px-4 py-3 transition ${
                        plan === id ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                      }`}>
                      <p className="font-bold text-sm text-[#141414]">{p.name}</p>
                      <p className="text-xs text-gray-400">{preco}</p>
                    </button>
                  );
                })}
              </div>

              {/* Modalidade — as duas anuais têm o MESMO desconto; muda só como
                  o dinheiro entra. O mensal não trava preço. */}
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

              {/* Forma de entrada — define QUANDO o acesso é liberado */}
              <label className={LABEL}>Como quer começar</label>
              <div className="space-y-3">
                <button onClick={() => setEntrada("trial")}
                  className={`w-full text-left border rounded-xl px-5 py-4 transition ${
                    entrada === "trial" ? "border-verde bg-verde/5" : "border-creme-200 hover:border-creme-300"
                  }`}>
                  <p className="font-bold text-sm text-verde mb-1">Testar 14 dias grátis</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Acesso liberado <strong>agora</strong>. A primeira cobrança de{" "}
                    <strong>{BRL(valorCobrado)}</strong> acontece só no <strong>15º dia</strong>.
                    Cancele quando quiser.
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
                    Sem período de teste. Geramos a cobrança na hora e o acesso é
                    liberado <strong>assim que o pagamento for confirmado</strong>.
                  </p>
                </button>
              </div>

              <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-verde" />
                Você paga na página segura do Asaas — por PIX, cartão ou boleto.
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
                {loading
                  ? (<><Loader2 size={16} className="animate-spin" /> Processando…</>)
                  : entrada === "direto" ? "Gerar cobrança" : "Começar teste grátis"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
