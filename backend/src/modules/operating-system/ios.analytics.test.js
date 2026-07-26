import test from "node:test";
import assert from "node:assert/strict";
import {
  computeArpa,
  computeCac,
  computeFinanceSummary,
  computeLtv,
  computeLtvCac,
  computePipelineSummary,
  isAcquisitionCost,
  resolveMonthPeriod,
  runOperatingProjection,
} from "./ios.analytics.js";

test("resolve período mensal em UTC", () => {
  const period = resolveMonthPeriod("2026-07");
  assert.equal(period.start.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(period.endExclusive.toISOString(), "2026-08-01T00:00:00.000Z");
});

test("calcula resultado, margem e burn sem misturar lançamentos", () => {
  const summary = computeFinanceSummary([
    { type: "receita", amount: 1000 },
    { type: "despesa", amount: 600 },
  ]);
  assert.deepEqual(summary, {
    revenue: 1000,
    costs: 600,
    acquisitionCosts: 0,
    result: 400,
    margin: 40,
    burnRate: 0,
    breakEvenRevenue: 600,
  });
});

test("soma apenas despesas classificadas como aquisição no CAC", () => {
  assert.equal(isAcquisitionCost({ type: "despesa", category: "Aquisicao" }), true);
  assert.equal(isAcquisitionCost({ type: "despesa", category: "infra" }), false);
  const summary = computeFinanceSummary([
    { type: "receita", amount: 1000 },
    { type: "despesa", amount: 300, category: "aquisicao" },
    { type: "despesa", amount: 200, category: "infra" },
  ]);
  assert.equal(summary.costs, 500);
  assert.equal(summary.acquisitionCosts, 300);
});

test("CAC divide aquisição pelas novas clínicas; indefinido sem novas", () => {
  assert.equal(computeCac(900, 3), 300);
  assert.equal(computeCac(900, 0), null);
});

test("LTV usa ARPA, margem e churn; LTV/CAC deriva dos dois", () => {
  const arpa = computeArpa(4000, 40); // 100
  assert.equal(arpa, 100);
  const ltv = computeLtv(arpa, 40, 5); // 100 * 0,40 / 0,05 = 800
  assert.equal(ltv, 800);
  assert.equal(computeLtvCac(ltv, 200), 4);
  // churn zero => LTV indefinido, não infinito
  assert.equal(computeLtv(arpa, 40, 0), null);
});

test("calcula conversão apenas sobre oportunidades resolvidas", () => {
  const summary = computePipelineSummary([
    { status: "fechado", value: 100 },
    { status: "perdido", value: 50 },
    { status: "proposta", value: 200 },
  ]);
  assert.equal(summary.conversionRate, 50);
  assert.equal(summary.activeValue, 200);
  assert.equal(summary.wonValue, 100);
});

test("projeção preserva premissas e produz série mensal determinística", () => {
  const result = runOperatingProjection({
    startingCash: 10000,
    startingMrr: 5000,
    monthlyGrowthRate: 10,
    monthlyChurnRate: 2,
    fixedCosts: 3000,
    variableCostRate: 10,
  }, new Date("2026-07-01T00:00:00.000Z"), new Date("2026-09-30T00:00:00.000Z"));

  assert.equal(result.horizonMonths, 3);
  assert.equal(result.breakEvenMrr, 3333.33);
  assert.deepEqual(result.points.map((point) => point.period), ["2026-07", "2026-08", "2026-09"]);
  assert.ok(result.endingCash > 10000);
  assert.ok(result.endingMrr > 5000);
});
