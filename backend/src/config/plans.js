export const ANNUAL_DISCOUNT = 0.10;

export const PLAN_CATALOG = Object.freeze({
  solo: Object.freeze({ id: "solo", name: "Solo", monthly: 99 }),
  clinica: Object.freeze({ id: "clinica", name: "Clínica", monthly: 139 }),
  pro: Object.freeze({ id: "pro", name: "Pro", monthly: 159 }),
  enterprise: Object.freeze({ id: "enterprise", name: "Enterprise", monthly: null }),
  dev: Object.freeze({ id: "dev", name: "Dev", monthly: 0 }),
  demo: Object.freeze({ id: "demo", name: "Demo", monthly: 0 }),
});

export const EXEMPT_BILLING_EMAILS = Object.freeze([
  "eurianebiomedica@gmail.com",
  "dra.fernandabecari@gmail.com",
]);

export function isBillingExempt(email) {
  return EXEMPT_BILLING_EMAILS.includes((email ?? "").trim().toLowerCase());
}

export function monthlyPlanValue(plan) {
  return PLAN_CATALOG[plan]?.monthly ?? 0;
}

export function annualPlanValue(plan) {
  const monthly = monthlyPlanValue(plan);
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
}

// Valor da parcela mensal no plano anual parcelado (mesmo desconto do à vista,
// diluído em 12 vezes).
export function annualMonthlyValue(plan) {
  return Math.round(monthlyPlanValue(plan) * (1 - ANNUAL_DISCOUNT) * 100) / 100;
}

// MRR oficial normaliza contratos anuais para sua competência mensal.
export function normalizedPlanMrr(plan, billingCycle = "mensal") {
  if (billingCycle !== "anual") return monthlyPlanValue(plan);
  return Math.round((annualPlanValue(plan) / 12) * 100) / 100;
}

// ── modalidades de contratação ────────────────────────────────────────────────
//
//   anual_avista    12 meses pagos de uma vez, com desconto. Preço travado.
//   anual_parcelado 12 meses no mesmo desconto, cobrados 1×/mês. Preço travado,
//                   sem comprometer limite de cartão de uma vez.
//   mensal          sem compromisso, preço cheio e sujeito a reajuste.
//
// As duas anuais têm o MESMO desconto: o que muda é só como o dinheiro entra.
export const MODALIDADES = Object.freeze({
  anual_avista:    Object.freeze({ id: "anual_avista",    billingCycle: "anual",  compromissoMeses: 12 }),
  anual_parcelado: Object.freeze({ id: "anual_parcelado", billingCycle: "anual",  compromissoMeses: 12 }),
  mensal:          Object.freeze({ id: "mensal",          billingCycle: "mensal", compromissoMeses: 0  }),
});

export function isModalidadeValida(m) {
  return Object.hasOwn(MODALIDADES, m ?? "");
}

// Valor e ciclo Asaas de cada modalidade.
export function cobrancaDaModalidade(plan, modalidade) {
  switch (modalidade) {
    case "anual_avista":
      return { value: annualPlanValue(plan), cycle: "YEARLY", parcelas: 1 };
    case "anual_parcelado":
      return { value: annualMonthlyValue(plan), cycle: "MONTHLY", parcelas: 12 };
    default:
      return { value: monthlyPlanValue(plan), cycle: "MONTHLY", parcelas: null };
  }
}

// Diferença devida quando um contrato ANUAL é cancelado antes dos 12 meses.
//
// O desconto anual é a contrapartida do compromisso de 12 meses. Saindo antes,
// os meses efetivamente usados passam a valer o preço mensal cheio, e a
// diferença entre isso e o que já foi pago é cobrada.
//
//   devido = (mensal_cheio × meses_usados) − total_pago
//
// Só se aplica a quem sai ANTES dos 12 meses: cumprido o compromisso, o
// desconto foi merecido e não há nada a cobrar, mesmo que a conta aritmética
// dê positiva.
//
// Nunca devolve valor negativo: se o cliente pagou mais do que os meses usados
// valem a preço cheio (caso do à vista cancelado cedo), não há multa — o
// reembolso do saldo é decisão comercial, não regra automática.
export function diferencaCancelamentoAntecipado({
  plan, mesesUsados, totalPago, compromissoMeses = 12,
}) {
  if (mesesUsados >= compromissoMeses) return 0; // cumpriu o contrato
  const cheio = monthlyPlanValue(plan) * Math.max(0, mesesUsados);
  const devido = cheio - (totalPago ?? 0);
  return devido > 0 ? Math.round(devido * 100) / 100 : 0;
}

export const PLAN_MRR = Object.freeze(
  Object.fromEntries(Object.keys(PLAN_CATALOG).map((plan) => [plan, monthlyPlanValue(plan)]))
);

export const PLAN_ARR = Object.freeze(
  Object.fromEntries(Object.keys(PLAN_CATALOG).map((plan) => [plan, annualPlanValue(plan)]))
);
