const DAY = 86400000;

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function percentage(part, total) {
  if (!Number.isFinite(Number(part)) || !Number.isFinite(Number(total)) || Number(total) <= 0) {
    return null;
  }
  return round((Number(part) / Number(total)) * 100);
}

export function resolveMonthPeriod(value, now = new Date()) {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  if (monthIndex < 0 || monthIndex > 11) throw new Error("IOS_INVALID_MONTH");
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    start,
    endExclusive,
    end: new Date(endExclusive.getTime() - 1),
  };
}

// Custo de aquisição (CAC) conta apenas a categoria dedicada "Aquisição".
// O operador classifica o lançamento manualmente no financeiro; marketing de
// marca e vendas genéricas NÃO entram automaticamente para não inflar o CAC.
const ACQUISITION_CATEGORIES = new Set(["aquisicao", "aquisição"]);

export function isAcquisitionCost(entry) {
  const category = (entry?.category ?? "").trim().toLowerCase();
  return ACQUISITION_CATEGORIES.has(category);
}

export function computeFinanceSummary(entries) {
  let revenue = 0;
  let costs = 0;
  let acquisitionCosts = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    if (entry.type === "receita") revenue += amount;
    if (entry.type === "despesa") {
      costs += amount;
      if (isAcquisitionCost(entry)) acquisitionCosts += amount;
    }
  }
  const result = revenue - costs;
  const burnRate = Math.max(costs - revenue, 0);
  return {
    revenue: round(revenue),
    costs: round(costs),
    acquisitionCosts: round(acquisitionCosts),
    result: round(result),
    margin: percentage(result, revenue),
    burnRate: round(burnRate),
    breakEvenRevenue: round(costs),
  };
}

// CAC = custo de aquisição do período ÷ novas clínicas pagantes do período.
// Sem novas clínicas, o CAC não é definível (não retorna número inventado).
export function computeCac(acquisitionCosts, newClinics) {
  if (!Number.isFinite(Number(acquisitionCosts)) || Number(newClinics) <= 0) return null;
  return round(Number(acquisitionCosts) / Number(newClinics));
}

// ARPA = receita recorrente média por clínica ativa (MRR ÷ ativas).
export function computeArpa(mrr, activeClinics) {
  if (Number(activeClinics) <= 0) return null;
  return round(Number(mrr) / Number(activeClinics));
}

// LTV = ARPA × margem bruta ÷ churn mensal.
// Depende de custos bem lançados (margem) e de churn > 0; caso contrário, indefinido.
export function computeLtv(arpa, marginPct, churnPct) {
  if (arpa === null || marginPct === null || churnPct === null) return null;
  const churn = Number(churnPct) / 100;
  const margin = Number(marginPct) / 100;
  if (churn <= 0) return null;
  return round((Number(arpa) * margin) / churn);
}

export function computeLtvCac(ltv, cac) {
  if (ltv === null || cac === null || Number(cac) <= 0) return null;
  return round(Number(ltv) / Number(cac));
}

export function computePipelineSummary(leads) {
  const stages = {};
  let activeValue = 0;
  let wonValue = 0;
  let won = 0;
  let lost = 0;
  for (const lead of leads) {
    const status = lead.status || "prospecto";
    stages[status] = (stages[status] || 0) + 1;
    const value = Number(lead.value) || 0;
    if (status === "fechado") {
      won += 1;
      wonValue += value;
    } else if (status === "perdido") {
      lost += 1;
    } else {
      activeValue += value;
    }
  }
  return {
    total: leads.length,
    stages,
    activeValue: round(activeValue),
    wonValue: round(wonValue),
    conversionRate: percentage(won, won + lost),
    resolved: won + lost,
    won,
    lost,
  };
}

function monthCount(start, end) {
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth() + 1;
  return Math.min(Math.max(months, 1), 60);
}

function monthLabel(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function runOperatingProjection(input, horizonStart, horizonEnd) {
  const values = {
    startingCash: Number(input.startingCash),
    startingMrr: Number(input.startingMrr),
    monthlyGrowthRate: Number(input.monthlyGrowthRate),
    monthlyChurnRate: Number(input.monthlyChurnRate),
    fixedCosts: Number(input.fixedCosts),
    variableCostRate: Number(input.variableCostRate),
  };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new Error(`IOS_PROJECTION_INPUT_${key}`);
  }
  if (horizonStart >= horizonEnd) throw new Error("IOS_PROJECTION_INVALID_HORIZON");
  if (values.startingCash < 0 || values.startingMrr < 0 || values.fixedCosts < 0) {
    throw new Error("IOS_PROJECTION_NEGATIVE_BASE");
  }
  if (
    values.monthlyGrowthRate < -100
    || values.monthlyChurnRate < 0
    || values.monthlyChurnRate > 100
    || values.variableCostRate < 0
    || values.variableCostRate > 100
  ) {
    throw new Error("IOS_PROJECTION_INVALID_RATE");
  }

  const months = monthCount(horizonStart, horizonEnd);
  const points = [];
  let cash = values.startingCash;
  let mrr = values.startingMrr;
  let firstNegativeCashMonth = null;

  for (let index = 0; index < months; index += 1) {
    const period = new Date(Date.UTC(
      horizonStart.getUTCFullYear(),
      horizonStart.getUTCMonth() + index,
      1
    ));
    if (index > 0) {
      mrr *= 1 + (values.monthlyGrowthRate / 100) - (values.monthlyChurnRate / 100);
      mrr = Math.max(mrr, 0);
    }
    const variableCosts = mrr * (values.variableCostRate / 100);
    const totalCosts = values.fixedCosts + variableCosts;
    const result = mrr - totalCosts;
    cash += result;
    if (cash < 0 && firstNegativeCashMonth === null) firstNegativeCashMonth = monthLabel(period);
    points.push({
      period: monthLabel(period),
      revenue: round(mrr),
      fixedCosts: round(values.fixedCosts),
      variableCosts: round(variableCosts),
      totalCosts: round(totalCosts),
      result: round(result),
      cash: round(cash),
    });
  }

  const contributionMargin = 1 - (values.variableCostRate / 100);
  const breakEvenMrr = contributionMargin > 0
    ? round(values.fixedCosts / contributionMargin)
    : null;
  const ending = points.at(-1);
  return {
    model: "finance.operating",
    version: "1",
    generatedAt: new Date().toISOString(),
    horizonMonths: months,
    breakEvenMrr,
    firstNegativeCashMonth,
    endingCash: ending?.cash ?? round(values.startingCash),
    endingMrr: ending?.revenue ?? round(values.startingMrr),
    points,
  };
}

export function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / DAY);
}
