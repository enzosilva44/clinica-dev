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

// MRR oficial normaliza contratos anuais para sua competência mensal.
export function normalizedPlanMrr(plan, billingCycle = "mensal") {
  if (billingCycle !== "anual") return monthlyPlanValue(plan);
  return Math.round((annualPlanValue(plan) / 12) * 100) / 100;
}

export const PLAN_MRR = Object.freeze(
  Object.fromEntries(Object.keys(PLAN_CATALOG).map((plan) => [plan, monthlyPlanValue(plan)]))
);

export const PLAN_ARR = Object.freeze(
  Object.fromEntries(Object.keys(PLAN_CATALOG).map((plan) => [plan, annualPlanValue(plan)]))
);
