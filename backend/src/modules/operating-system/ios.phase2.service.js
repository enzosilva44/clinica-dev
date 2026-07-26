import { prisma } from "../../config/prisma.js";
import {
  isBillingExempt,
  normalizedPlanMrr,
} from "../../config/plans.js";
import { iosAuditData } from "./ios.audit.js";
import { assertIos } from "./ios.errors.js";
import {
  computeArpa,
  computeCac,
  computeFinanceSummary,
  computeLtv,
  computeLtvCac,
  computePipelineSummary,
  percentage,
  resolveMonthPeriod,
  round,
  runOperatingProjection,
} from "./ios.analytics.js";

const OFFICIAL_METRICS = [
  {
    code: "growth.mrr",
    name: "MRR normalizado",
    description: "Receita recorrente mensal contratada, normalizando contratos anuais por competência.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "User.plan + User.billingCycle + config/plans.js",
  },
  {
    code: "growth.arr",
    name: "ARR normalizado",
    description: "Receita recorrente anual normalizada a partir do MRR oficial.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "growth.mrr × 12",
  },
  {
    code: "growth.active_clinics",
    name: "Clínicas ativas",
    description: "Clínicas pagantes ativas ao fim do período.",
    unit: "NUMBER",
    direction: "INCREASE",
    sourceRef: "User.createdAt + User.canceledAt + billing exemptions",
  },
  {
    code: "growth.new_clinics",
    name: "Novas clínicas",
    description: "Novas clínicas pagantes criadas no período.",
    unit: "NUMBER",
    direction: "INCREASE",
    sourceRef: "User.createdAt",
  },
  {
    code: "growth.canceled_clinics",
    name: "Cancelamentos",
    description: "Clínicas pagantes canceladas no período.",
    unit: "NUMBER",
    direction: "DECREASE",
    sourceRef: "IosBusinessEvent subscription.canceled + User.canceledAt",
  },
  {
    code: "growth.logo_churn",
    name: "Logo churn",
    description: "Cancelamentos do período divididos pela base ativa no início do período.",
    unit: "PERCENTAGE",
    direction: "DECREASE",
    sourceRef: "growth.canceled_clinics / base ativa inicial",
  },
  {
    code: "growth.retention",
    name: "Retenção de logos",
    description: "Percentual da base inicial não cancelada no período.",
    unit: "PERCENTAGE",
    direction: "INCREASE",
    sourceRef: "100 - growth.logo_churn",
  },
  {
    code: "growth.growth_rate",
    name: "Crescimento de MRR",
    description: "Variação percentual do MRR em relação ao mês anterior.",
    unit: "PERCENTAGE",
    direction: "INCREASE",
    sourceRef: "(growth.mrr atual / growth.mrr anterior) - 1",
  },
  {
    code: "growth.cac",
    name: "CAC",
    description: "Custo de aquisição por nova clínica: despesas classificadas como aquisição divididas pelas novas clínicas pagantes do período.",
    unit: "BRL",
    direction: "DECREASE",
    sourceRef: "AdminFinancialEntry (category=aquisicao) / growth.new_clinics",
  },
  {
    code: "growth.ltv",
    name: "LTV",
    description: "Valor do tempo de vida do cliente: ARPA ajustado pela margem bruta dividido pelo churn mensal. Depende de custos bem lançados.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "(MRR / clínicas ativas) × finance.margin / growth.logo_churn",
  },
  {
    code: "growth.ltv_cac",
    name: "LTV / CAC",
    description: "Retorno sobre o investimento em aquisição. Referência saudável de SaaS acima de 3.",
    unit: "RATIO",
    direction: "INCREASE",
    sourceRef: "growth.ltv / growth.cac",
  },
  {
    code: "sales.win_rate",
    name: "Taxa de conversão comercial",
    description: "Leads fechados divididos por oportunidades resolvidas.",
    unit: "PERCENTAGE",
    direction: "INCREASE",
    sourceRef: "Lead.status",
  },
  {
    code: "sales.pipeline_value",
    name: "Valor do pipeline",
    description: "MRR estimado das oportunidades comerciais ainda abertas.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "Lead.value + Lead.status",
  },
  {
    code: "finance.revenue",
    name: "Receitas realizadas",
    description: "Receitas aprovadas e pagas no período no financeiro administrativo.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "AdminFinancialEntry aprovado",
  },
  {
    code: "finance.costs",
    name: "Custos realizados",
    description: "Despesas aprovadas e pagas no período no financeiro administrativo.",
    unit: "BRL",
    direction: "DECREASE",
    sourceRef: "AdminFinancialEntry aprovado",
  },
  {
    code: "finance.result",
    name: "Resultado",
    description: "Receitas menos custos realizados no período.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "finance.revenue - finance.costs",
  },
  {
    code: "finance.margin",
    name: "Margem operacional",
    description: "Resultado dividido pelas receitas realizadas.",
    unit: "PERCENTAGE",
    direction: "INCREASE",
    sourceRef: "finance.result / finance.revenue",
  },
  {
    code: "finance.burn_rate",
    name: "Burn rate líquido",
    description: "Consumo líquido mensal de caixa quando custos superam receitas.",
    unit: "BRL",
    direction: "DECREASE",
    sourceRef: "max(finance.costs - finance.revenue, 0)",
  },
  {
    code: "finance.cash_balance",
    name: "Caixa registrado",
    description: "Saldo acumulado dos lançamentos aprovados registrados no admin; não substitui conciliação bancária.",
    unit: "BRL",
    direction: "INCREASE",
    sourceRef: "AdminFinancialEntry acumulado",
  },
  {
    code: "finance.runway",
    name: "Runway",
    description: "Meses de caixa com base no burn rate líquido do período.",
    unit: "MONTHS",
    direction: "INCREASE",
    sourceRef: "finance.cash_balance / finance.burn_rate",
  },
];

function requireWorkspace(context) {
  assertIos(
    context.organization && context.membership?.isActive,
    409,
    "IOS_NOT_INITIALIZED",
    "Inicialize o IASO Operating System antes de continuar."
  );
  return context.organization;
}

function billable(clinic) {
  return !isBillingExempt(clinic.email)
    && !["dev", "demo"].includes(clinic.plan);
}

function inPeriod(value, period) {
  if (!value) return false;
  const date = new Date(value);
  return date >= period.start && date < period.endExclusive;
}

function activeAt(clinic, date) {
  return new Date(clinic.createdAt) < date
    && (!clinic.canceledAt || new Date(clinic.canceledAt) >= date);
}

async function performanceData(period, organizationId) {
  const [clinics, entries, allEntries, leads, cancelEvents] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PROFESSIONAL" },
      select: {
        id: true,
        email: true,
        plan: true,
        billingCycle: true,
        createdAt: true,
        canceledAt: true,
      },
    }),
    prisma.adminFinancialEntry.findMany({
      where: {
        recorrente: false,
        status: "aprovado",
        OR: [
          { paidAt: { gte: period.start, lt: period.endExclusive } },
          {
            paidAt: null,
            approvedAt: { gte: period.start, lt: period.endExclusive },
          },
        ],
      },
      select: { type: true, amount: true },
    }),
    prisma.adminFinancialEntry.findMany({
      where: { recorrente: false, status: "aprovado" },
      select: { type: true, amount: true },
    }),
    prisma.lead.findMany({
      select: { id: true, status: true, value: true, source: true, createdAt: true },
    }),
    prisma.iosBusinessEvent.findMany({
      where: {
        organizationId,
        eventType: "subscription.canceled",
        occurredAt: { gte: period.start, lt: period.endExclusive },
      },
      select: { subjectId: true, occurredAt: true },
    }),
  ]);
  return { clinics, entries, allEntries, leads, cancelEvents };
}

export async function getPerformanceOverview(context, month) {
  const organization = requireWorkspace(context);
  let period;
  try {
    period = resolveMonthPeriod(month);
  } catch {
    assertIos(false, 400, "IOS_INVALID_MONTH", "month deve usar o formato YYYY-MM.");
  }
  const { clinics, entries, allEntries, leads, cancelEvents } = await performanceData(
    period,
    organization.id
  );
  const paying = clinics.filter(billable);
  const payingIds = new Set(paying.map((clinic) => clinic.id));
  const activeStart = paying.filter((clinic) => activeAt(clinic, period.start));
  const activeEnd = paying.filter((clinic) => activeAt(clinic, period.endExclusive));
  const newClinics = paying.filter((clinic) => inPeriod(clinic.createdAt, period));
  const canceledIds = new Set([
    ...paying.filter((clinic) => inPeriod(clinic.canceledAt, period)).map((clinic) => clinic.id),
    ...cancelEvents
      .map((event) => event.subjectId)
      .filter((clinicId) => clinicId && payingIds.has(clinicId)),
  ]);
  const cancellations = canceledIds.size;
  const churn = percentage(cancellations, activeStart.length);
  const retention = churn === null ? null : round(Math.max(100 - churn, 0));
  const mrrOf = (clinicList) => round(clinicList.reduce(
    (sum, clinic) => sum + normalizedPlanMrr(clinic.plan, clinic.billingCycle),
    0
  ));
  const mrr = mrrOf(activeEnd);
  // MRR na virada do mês anterior = base ativa no início deste período.
  const previousMrr = mrrOf(activeStart);
  const growthRate = previousMrr > 0 ? round(((mrr - previousMrr) / previousMrr) * 100) : null;
  const finance = computeFinanceSummary(entries);
  const cumulativeFinance = computeFinanceSummary(allEntries);
  const cashBalance = cumulativeFinance.result;
  const runway = finance.burnRate > 0 ? round(Math.max(cashBalance, 0) / finance.burnRate) : null;
  const pipeline = computePipelineSummary(leads);

  // CAC / LTV / LTV:CAC — dependem de classificação de despesas e churn.
  const cac = computeCac(finance.acquisitionCosts, newClinics.length);
  const arpa = computeArpa(mrr, activeEnd.length);
  const ltv = computeLtv(arpa, finance.margin, churn);
  const ltvCac = computeLtvCac(ltv, cac);

  const values = {
    "growth.mrr": mrr,
    "growth.arr": round(mrr * 12),
    "growth.active_clinics": activeEnd.length,
    "growth.new_clinics": newClinics.length,
    "growth.canceled_clinics": cancellations,
    "growth.logo_churn": churn,
    "growth.retention": retention,
    "growth.growth_rate": growthRate,
    "growth.cac": cac,
    "growth.ltv": ltv,
    "growth.ltv_cac": ltvCac,
    "sales.win_rate": pipeline.conversionRate,
    "sales.pipeline_value": pipeline.activeValue,
    "finance.revenue": finance.revenue,
    "finance.costs": finance.costs,
    "finance.result": finance.result,
    "finance.margin": finance.margin,
    "finance.burn_rate": finance.burnRate,
    "finance.cash_balance": cashBalance,
    "finance.runway": runway,
  };

  // Qualidade do dado por métrica:
  // PARTIAL_HISTORY = depende do ledger de eventos ainda em formação;
  // REGISTERED_DATA = confia em lançamentos/classificações manuais do admin;
  // OFFICIAL = derivada de fontes estruturadas do produto.
  const METRIC_QUALITY = {
    "growth.logo_churn": "PARTIAL_HISTORY",
    "growth.retention": "PARTIAL_HISTORY",
    "growth.cac": "REGISTERED_DATA",
    "growth.ltv": "REGISTERED_DATA",
    "growth.ltv_cac": "REGISTERED_DATA",
    "finance.cash_balance": "REGISTERED_DATA",
    "finance.runway": "REGISTERED_DATA",
  };
  const metrics = OFFICIAL_METRICS.map((definition) => ({
    ...definition,
    value: values[definition.code] ?? null,
    periodStart: period.start,
    periodEnd: period.end,
    formulaVersion: "1",
    quality: METRIC_QUALITY[definition.code] ?? "OFFICIAL",
  }));

  return {
    period: {
      key: period.key,
      start: period.start,
      end: period.end,
    },
    growth: {
      mrr,
      arr: round(mrr * 12),
      activeClinics: activeEnd.length,
      activeAtStart: activeStart.length,
      newClinics: newClinics.length,
      cancellations,
      logoChurn: churn,
      retention,
      growthRate,
      arpa,
      cac,
      ltv,
      ltvCac,
    },
    finance: {
      ...finance,
      cashBalance,
      runway,
    },
    commercial: pipeline,
    metrics,
    caveats: [
      "MRR representa receita contratada normalizada; não confirma recebimento bancário.",
      "Churn anterior ao início do ledger de eventos usa User.canceledAt e possui qualidade parcial.",
      "Caixa e runway usam apenas lançamentos aprovados registrados no admin e não substituem conciliação bancária.",
      "CAC usa despesas classificadas manualmente como aquisição; sem novas clínicas no mês, fica indefinido.",
      "LTV usa margem bruta e churn do período; depende de custos lançados corretamente e só é confiável com histórico suficiente.",
    ],
  };
}

export async function syncOfficialMetrics(context, month) {
  const organization = requireWorkspace(context);
  const overview = await getPerformanceOverview(context, month);
  const synced = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const item of overview.metrics) {
      const definition = await tx.iosMetricDefinition.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: item.code,
          },
        },
        create: {
          organizationId: organization.id,
          code: item.code,
          name: item.name,
          description: item.description,
          unit: item.unit,
          direction: item.direction,
          frequency: "MONTHLY",
          sourceType: "CALCULATED",
          sourceRef: item.sourceRef,
          formulaKey: item.code,
          formulaVersion: item.formulaVersion,
          allowManualInput: false,
          ownerId: context.membership.id,
        },
        update: {
          name: item.name,
          description: item.description,
          unit: item.unit,
          direction: item.direction,
          sourceType: "CALCULATED",
          sourceRef: item.sourceRef,
          formulaKey: item.code,
          formulaVersion: item.formulaVersion,
          allowManualInput: false,
          isActive: true,
        },
      });
      if (item.value === null) continue;
      await tx.iosMetricObservation.deleteMany({
        where: {
          metricId: definition.id,
          periodStart: overview.period.start,
          periodEnd: overview.period.end,
          sourceType: "CALCULATED",
          formulaVersion: item.formulaVersion,
        },
      });
      const observation = await tx.iosMetricObservation.create({
        data: {
          metricId: definition.id,
          periodStart: overview.period.start,
          periodEnd: overview.period.end,
          value: String(item.value),
          sourceType: "CALCULATED",
          sourceRef: item.sourceRef,
          formulaVersion: item.formulaVersion,
          inputs: { quality: item.quality },
          createdBy: context.actor.id,
        },
      });
      rows.push({ metricId: definition.id, observationId: observation.id, code: item.code });
    }
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.metrics.sync",
        entityType: "metric-observation",
        metadata: { period: overview.period.key, count: rows.length },
        after: rows,
      }),
    });
    return rows;
  }, { timeout: 30000 });
  return { period: overview.period, synced };
}

const scenarioInclude = {
  assumptions: { orderBy: { sortOrder: "asc" } },
  runs: { orderBy: { executedAt: "desc" }, take: 5 },
};

export async function listScenarios(context) {
  const organization = requireWorkspace(context);
  return prisma.iosScenario.findMany({
    where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
    include: scenarioInclude,
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function createScenario(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.iosScenario.create({
      data: {
        organizationId: organization.id,
        name: data.name,
        description: data.description,
        horizonStart: data.horizonStart,
        horizonEnd: data.horizonEnd,
        createdBy: context.actor.id,
        assumptions: { create: data.assumptions },
      },
      include: scenarioInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.scenario.create",
        entityType: "scenario",
        entityId: scenario.id,
        after: scenario,
      }),
    });
    return scenario;
  });
}

async function scenarioForWrite(tx, context, id) {
  const organization = requireWorkspace(context);
  const scenario = await tx.iosScenario.findFirst({
    where: { id, organizationId: organization.id },
    include: scenarioInclude,
  });
  assertIos(scenario, 404, "IOS_SCENARIO_NOT_FOUND", "Cenário não encontrado.");
  return scenario;
}

export async function updateScenario(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await scenarioForWrite(tx, context, id);
    assertIos(
      before.status === "DRAFT",
      409,
      "IOS_SCENARIO_IMMUTABLE",
      "Cenário publicado é imutável; crie uma nova versão."
    );
    const { assumptions, ...scenarioData } = data;
    const nextStart = scenarioData.horizonStart ?? before.horizonStart;
    const nextEnd = scenarioData.horizonEnd ?? before.horizonEnd;
    assertIos(
      nextStart < nextEnd,
      400,
      "IOS_SCENARIO_INVALID_HORIZON",
      "A data final deve ser posterior à data inicial."
    );
    if (assumptions) {
      await tx.iosScenarioAssumption.deleteMany({ where: { scenarioId: id } });
      await tx.iosScenarioAssumption.createMany({
        data: assumptions.map((item) => ({ ...item, scenarioId: id })),
      });
    }
    const after = await tx.iosScenario.update({
      where: { id },
      data: scenarioData,
      include: scenarioInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.scenario.update",
        entityType: "scenario",
        entityId: id,
        before,
        after,
      }),
    });
    return after;
  });
}

export async function publishScenario(context, id) {
  return prisma.$transaction(async (tx) => {
    const before = await scenarioForWrite(tx, context, id);
    assertIos(
      before.status === "DRAFT",
      409,
      "IOS_SCENARIO_ALREADY_PUBLISHED",
      "O cenário já foi publicado ou arquivado."
    );
    assertIos(
      before.runs.length > 0,
      409,
      "IOS_SCENARIO_RUN_REQUIRED",
      "Execute a projeção antes de publicar o cenário."
    );
    const after = await tx.iosScenario.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: scenarioInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.scenario.publish",
        entityType: "scenario",
        entityId: id,
        before,
        after,
      }),
    });
    return after;
  });
}

export async function versionScenario(context, id) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const source = await scenarioForWrite(tx, context, id);
    const latest = await tx.iosScenario.aggregate({
      where: { organizationId: organization.id, name: source.name },
      _max: { version: true },
    });
    const scenario = await tx.iosScenario.create({
      data: {
        organizationId: organization.id,
        name: source.name,
        description: source.description,
        version: (latest._max.version ?? source.version) + 1,
        horizonStart: source.horizonStart,
        horizonEnd: source.horizonEnd,
        basedOnId: source.id,
        createdBy: context.actor.id,
        assumptions: {
          create: source.assumptions.map((item) => ({
            key: item.key,
            label: item.label,
            value: item.value,
            textValue: item.textValue,
            unit: item.unit,
            justification: item.justification,
            sourceRef: item.sourceRef,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: scenarioInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.scenario.version",
        entityType: "scenario",
        entityId: scenario.id,
        metadata: { basedOnId: source.id },
        after: scenario,
      }),
    });
    return scenario;
  });
}

export async function runScenario(context, id) {
  return prisma.$transaction(async (tx) => {
    const scenario = await scenarioForWrite(tx, context, id);
    assertIos(
      scenario.status === "DRAFT",
      409,
      "IOS_SCENARIO_IMMUTABLE",
      "Cenário publicado é imutável; crie uma nova versão."
    );
    const inputs = Object.fromEntries(
      scenario.assumptions
        .filter((item) => item.value !== null)
        .map((item) => [item.key, Number(item.value)])
    );
    const required = [
      "startingCash",
      "startingMrr",
      "monthlyGrowthRate",
      "monthlyChurnRate",
      "fixedCosts",
      "variableCostRate",
    ];
    const missing = required.filter((key) => !Number.isFinite(inputs[key]));
    assertIos(
      missing.length === 0,
      400,
      "IOS_SCENARIO_ASSUMPTIONS_REQUIRED",
      `Premissas obrigatórias ausentes: ${missing.join(", ")}.`
    );
    let outputs;
    try {
      outputs = runOperatingProjection(inputs, scenario.horizonStart, scenario.horizonEnd);
    } catch (error) {
      assertIos(false, 400, "IOS_PROJECTION_INVALID_INPUT", error.message);
    }
    const run = await tx.iosProjectionRun.create({
      data: {
        scenarioId: scenario.id,
        modelKey: outputs.model,
        modelVersion: outputs.version,
        inputs,
        outputs,
        createdBy: context.actor.id,
      },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.scenario.run",
        entityType: "projection-run",
        entityId: run.id,
        metadata: { scenarioId: scenario.id, model: outputs.model, version: outputs.version },
        after: run,
      }),
    });
    return run;
  });
}
