/**
 * Fonte ÚNICA de planos e preços do IASOClin.
 * Todos os lugares (landing, signup, settings, contratar) importam daqui.
 * Para mudar preço: altere SÓ este arquivo.
 *
 * Regra de cobrança anual: 12× o mensal com 10% de desconto.
 * O admin (backend) tem seu próprio espelho em backend/src/config/plans.js —
 * mantenha os dois em sincronia ao alterar preços.
 */

export const ANNUAL_DISCOUNT = 0.10; // 10% off no plano anual

const BRL = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

// Deriva os valores anuais a partir do mensal (−10%).
function withAnnual(monthly) {
  if (monthly == null) return null;
  const annualMonthly = monthly * (1 - ANNUAL_DISCOUNT); // valor/mês no plano anual
  const annualTotal = annualMonthly * 12;                 // cobrado 1×/ano
  const savings = monthly * 12 - annualTotal;             // economia em R$/ano
  return { annualMonthly, annualTotal, savings };
}

export const PLANS = [
  {
    id: "solo",
    name: "Solo",
    monthly: 99,
    sub: "para 1 profissional",
    desc: "Para profissionais autônomos",
    features: [
      "1 usuário",
      "Pacientes ilimitados",
      "Agenda, sessões e evoluções",
      "Prontuário + mapa de procedimentos",
      "WhatsApp e cobranças",
      "Insights com IA",
    ],
    highlight: false,
  },
  {
    id: "clinica",
    name: "Clínica",
    monthly: 139,
    sub: "até 3 profissionais",
    desc: "Para clínicas em crescimento",
    features: [
      "Tudo do Solo",
      "Até 3 usuários",
      "Documentos com validade jurídica",
      "Financeiro automatizado",
      "Guardião IA (financeiro e estoque)",
      "Relatórios com histórico",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 159,
    sub: "até 5 profissionais",
    desc: "Para clínicas consolidadas",
    features: [
      "Tudo da Clínica",
      "Até 5 usuários",
      "IA e automações no limite máximo",
      "Analytics completo",
      "Prioridade no suporte",
    ],
    highlight: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null, // sob consulta
    sub: "redes e franquias",
    desc: "Para redes e franquias",
    features: [
      "Usuários ilimitados",
      "Multi-clínica",
      "Suporte dedicado",
      "Onboarding personalizado",
      "SLA garantido",
    ],
    highlight: false,
  },
].map((p) => ({
  ...p,
  ...withAnnual(p.monthly),
  // strings prontas pra exibição
  priceMonthlyLabel: p.monthly == null ? "Sob consulta" : BRL(p.monthly),
  priceAnnualLabel:
    p.monthly == null ? "Sob consulta" : BRL(p.monthly * (1 - ANNUAL_DISCOUNT)),
}));

export const PLANS_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p]));

export { BRL };
