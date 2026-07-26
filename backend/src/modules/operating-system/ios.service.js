import { prisma } from "../../config/prisma.js";
import { IOS_ORGANIZATION_SLUG } from "./ios.access.js";
import { iosAuditData } from "./ios.audit.js";
import { assertIos } from "./ios.errors.js";
import { keyResultProgress, metricTrend, objectiveProgress } from "./ios.progress.js";
import { assertDateRange } from "./ios.validation.js";

const memberInclude = {
  user: { select: { id: true, name: true, email: true } },
};

const metricInclude = {
  owner: { include: memberInclude },
  observations: {
    orderBy: [{ periodEnd: "desc" }, { measuredAt: "desc" }],
    take: 2,
  },
};

const cycleInclude = {
  owner: { include: memberInclude },
  objectives: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      owner: { include: memberInclude },
      keyResults: {
        orderBy: { createdAt: "asc" },
        include: {
          owner: { include: memberInclude },
          metric: { include: metricInclude },
        },
      },
    },
  },
  initiatives: {
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      owner: { include: memberInclude },
      milestones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      taskLinks: {
        orderBy: { linkedAt: "desc" },
        include: {
          task: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
            },
          },
        },
      },
    },
  },
};

function serializeObservation(observation) {
  if (!observation) return null;
  return { ...observation, value: String(observation.value) };
}

function serializeMetric(metric) {
  const observations = (metric.observations ?? []).map(serializeObservation);
  return {
    ...metric,
    observations,
    currentObservation: observations[0] ?? null,
    trend: metricTrend(observations, metric.direction),
  };
}

function serializeKeyResult(keyResult) {
  const metric = serializeMetric(keyResult.metric);
  const current = metric.currentObservation?.value ?? null;
  return {
    ...keyResult,
    baseline: String(keyResult.baseline),
    target: String(keyResult.target),
    metric,
    current,
    progress: keyResultProgress({
      baseline: keyResult.baseline,
      target: keyResult.target,
      current,
    }),
  };
}

function serializeCycle(cycle) {
  if (!cycle) return null;
  const objectives = cycle.objectives.map((objective) => {
    const keyResults = objective.keyResults.map(serializeKeyResult);
    return {
      ...objective,
      keyResults,
      progress: objectiveProgress(keyResults),
    };
  });
  const initiatives = cycle.initiatives.map((initiative) => {
    const total = initiative.milestones.length;
    const completed = initiative.milestones.filter((item) => item.status === "COMPLETED").length;
    return {
      ...initiative,
      progress: total ? Math.round((completed / total) * 100) : null,
    };
  });
  return { ...cycle, objectives, initiatives };
}

function requireWorkspace(context) {
  assertIos(
    context.organization,
    409,
    "IOS_NOT_INITIALIZED",
    "Inicialize o IASO Operating System antes de continuar."
  );
  assertIos(
    context.membership?.isActive,
    403,
    "IOS_MEMBERSHIP_INACTIVE",
    "Seu acesso ao IASO Operating System não está ativo."
  );
  return context.organization;
}

async function audit(tx, context, payload) {
  return tx.iosAuditLog.create({ data: iosAuditData(context, payload) });
}

async function findCycle(tx, context, id) {
  const organization = requireWorkspace(context);
  const cycle = await tx.iosStrategyCycle.findFirst({
    where: { id, organizationId: organization.id },
  });
  assertIos(cycle, 404, "IOS_CYCLE_NOT_FOUND", "Ciclo estratégico não encontrado.");
  return cycle;
}

async function findObjective(tx, context, id) {
  const organization = requireWorkspace(context);
  const objective = await tx.iosObjective.findFirst({
    where: { id, cycle: { organizationId: organization.id } },
  });
  assertIos(objective, 404, "IOS_OBJECTIVE_NOT_FOUND", "Objetivo não encontrado.");
  return objective;
}

async function findMetric(tx, context, id) {
  const organization = requireWorkspace(context);
  const metric = await tx.iosMetricDefinition.findFirst({
    where: { id, organizationId: organization.id },
  });
  assertIos(metric, 404, "IOS_METRIC_NOT_FOUND", "Métrica não encontrada.");
  return metric;
}

async function findKeyResult(tx, context, id) {
  const organization = requireWorkspace(context);
  const keyResult = await tx.iosKeyResult.findFirst({
    where: { id, objective: { cycle: { organizationId: organization.id } } },
  });
  assertIos(keyResult, 404, "IOS_KEY_RESULT_NOT_FOUND", "Resultado-chave não encontrado.");
  return keyResult;
}

async function findInitiative(tx, context, id) {
  const organization = requireWorkspace(context);
  const initiative = await tx.iosInitiative.findFirst({
    where: { id, cycle: { organizationId: organization.id } },
  });
  assertIos(initiative, 404, "IOS_INITIATIVE_NOT_FOUND", "Iniciativa não encontrada.");
  return initiative;
}

async function findMilestone(tx, context, id) {
  const organization = requireWorkspace(context);
  const milestone = await tx.iosMilestone.findFirst({
    where: { id, initiative: { cycle: { organizationId: organization.id } } },
  });
  assertIos(milestone, 404, "IOS_MILESTONE_NOT_FOUND", "Marco não encontrado.");
  return milestone;
}

async function findDecision(tx, context, id) {
  const organization = requireWorkspace(context);
  const decision = await tx.iosDecision.findFirst({
    where: { id, organizationId: organization.id },
  });
  assertIos(decision, 404, "IOS_DECISION_NOT_FOUND", "Decisão não encontrada.");
  return decision;
}

async function ensureObjectiveInCycle(tx, context, objectiveId, cycleId) {
  if (!objectiveId) return;
  const objective = await findObjective(tx, context, objectiveId);
  assertIos(
    objective.cycleId === cycleId,
    409,
    "IOS_OBJECTIVE_CYCLE_MISMATCH",
    "O objetivo não pertence ao ciclo informado."
  );
}

async function ensureMember(tx, context, memberId) {
  if (!memberId) return null;
  const organization = requireWorkspace(context);
  const member = await tx.iosMembership.findFirst({
    where: { id: memberId, organizationId: organization.id, isActive: true },
  });
  assertIos(member, 400, "IOS_MEMBER_NOT_FOUND", "Responsável inválido.");
  return member;
}

export async function getAccess(context) {
  return {
    allowed: true,
    initialized: Boolean(context.organization && context.membership?.isActive),
    user: context.actor,
    membership: context.membership,
  };
}

export async function bootstrap(context) {
  return prisma.$transaction(async (tx) => {
    let organization = await tx.iosOrganization.findUnique({
      where: { slug: IOS_ORGANIZATION_SLUG },
    });
    const created = !organization;
    if (!organization) {
      organization = await tx.iosOrganization.create({
        data: {
          name: "Iaso",
          slug: IOS_ORGANIZATION_SLUG,
          values: [],
        },
      });
    }

    const membership = await tx.iosMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: context.actor.id,
        },
      },
      create: {
        organizationId: organization.id,
        userId: context.actor.id,
        role: "OWNER",
        capabilities: ["*"],
      },
      update: {
        role: "OWNER",
        capabilities: ["*"],
        isActive: true,
      },
      include: memberInclude,
    });

    const auditContext = { ...context, organization, membership };
    await audit(tx, auditContext, {
      action: created ? "ios.workspace.bootstrap" : "ios.membership.restore",
      entityType: "workspace",
      entityId: organization.id,
      after: organization,
    });

    return { initialized: true, workspace: organization, membership };
  });
}

export async function getWorkspace(context) {
  if (!context.organization) return { initialized: false, workspace: null, membership: null };
  return {
    initialized: Boolean(context.membership?.isActive),
    workspace: context.organization,
    membership: context.membership,
  };
}

export async function updateWorkspace(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const before = await tx.iosOrganization.findUnique({ where: { id: organization.id } });
    const after = await tx.iosOrganization.update({
      where: { id: organization.id },
      data,
    });
    await audit(tx, context, {
      action: "ios.workspace.update",
      entityType: "workspace",
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function getTeam(context) {
  const organization = requireWorkspace(context);
  return prisma.iosMembership.findMany({
    where: { organizationId: organization.id, isActive: true },
    include: memberInclude,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

export async function listCycles(context) {
  const organization = requireWorkspace(context);
  const cycles = await prisma.iosStrategyCycle.findMany({
    where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
    include: cycleInclude,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 50,
  });
  return cycles.map(serializeCycle);
}

export async function createCycle(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    await ensureMember(tx, context, data.ownerId);
    if (data.status === "ACTIVE") {
      await tx.iosStrategyCycle.updateMany({
        where: { organizationId: organization.id, status: "ACTIVE" },
        data: { status: "CLOSED" },
      });
    }
    const cycle = await tx.iosStrategyCycle.create({
      data: {
        ...data,
        organizationId: organization.id,
        ownerId: data.ownerId ?? context.membership.id,
      },
    });
    await audit(tx, context, {
      action: "ios.cycle.create",
      entityType: "cycle",
      entityId: cycle.id,
      after: cycle,
    });
    return cycle;
  });
}

export async function updateCycle(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findCycle(tx, context, id);
    assertDateRange(data.startDate ?? before.startDate, data.endDate ?? before.endDate);
    await ensureMember(tx, context, data.ownerId);
    if (data.status === "ACTIVE") {
      await tx.iosStrategyCycle.updateMany({
        where: {
          organizationId: before.organizationId,
          status: "ACTIVE",
          id: { not: before.id },
        },
        data: { status: "CLOSED" },
      });
    }
    const after = await tx.iosStrategyCycle.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.cycle.update",
      entityType: "cycle",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function archiveCycle(context, id) {
  return updateCycle(context, id, { status: "ARCHIVED" });
}

export async function listMetrics(context) {
  const organization = requireWorkspace(context);
  const metrics = await prisma.iosMetricDefinition.findMany({
    where: { organizationId: organization.id },
    include: metricInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 200,
  });
  return metrics.map(serializeMetric);
}

export async function createMetric(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    await ensureMember(tx, context, data.ownerId);
    const metric = await tx.iosMetricDefinition.create({
      data: {
        ...data,
        organizationId: organization.id,
        ownerId: data.ownerId ?? context.membership.id,
      },
    });
    await audit(tx, context, {
      action: "ios.metric.create",
      entityType: "metric",
      entityId: metric.id,
      after: metric,
    });
    return metric;
  });
}

export async function updateMetric(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findMetric(tx, context, id);
    await ensureMember(tx, context, data.ownerId);
    const after = await tx.iosMetricDefinition.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.metric.update",
      entityType: "metric",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function createMetricObservation(context, metricId, data) {
  return prisma.$transaction(async (tx) => {
    const metric = await findMetric(tx, context, metricId);
    assertIos(
      metric.allowManualInput,
      409,
      "IOS_METRIC_MANUAL_INPUT_DISABLED",
      "Esta métrica não aceita lançamento manual."
    );
    const observation = await tx.iosMetricObservation.create({
      data: {
        ...data,
        metricId,
        sourceType: "MANUAL",
        createdBy: context.actor.id,
      },
    });
    await audit(tx, context, {
      action: "ios.metric.observation.create",
      entityType: "metric_observation",
      entityId: observation.id,
      after: observation,
      metadata: { metricId, metricCode: metric.code },
    });
    return serializeObservation(observation);
  });
}

export async function createObjective(context, cycleId, data) {
  return prisma.$transaction(async (tx) => {
    await findCycle(tx, context, cycleId);
    await ensureMember(tx, context, data.ownerId);
    const objective = await tx.iosObjective.create({
      data: {
        ...data,
        cycleId,
        ownerId: data.ownerId ?? context.membership.id,
      },
    });
    await audit(tx, context, {
      action: "ios.objective.create",
      entityType: "objective",
      entityId: objective.id,
      after: objective,
    });
    return objective;
  });
}

export async function updateObjective(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findObjective(tx, context, id);
    await ensureMember(tx, context, data.ownerId);
    const after = await tx.iosObjective.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.objective.update",
      entityType: "objective",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function cancelObjective(context, id) {
  return updateObjective(context, id, { status: "CANCELED" });
}

export async function createKeyResult(context, objectiveId, data) {
  return prisma.$transaction(async (tx) => {
    const objective = await findObjective(tx, context, objectiveId);
    const metric = await findMetric(tx, context, data.metricId);
    await ensureMember(tx, context, data.ownerId);
    assertIos(
      objective.cycleId && metric.organizationId === context.organization.id,
      409,
      "IOS_METRIC_ORGANIZATION_MISMATCH",
      "A métrica não pertence ao workspace."
    );
    const keyResult = await tx.iosKeyResult.create({
      data: {
        ...data,
        objectiveId,
        ownerId: data.ownerId ?? context.membership.id,
      },
    });
    await audit(tx, context, {
      action: "ios.key_result.create",
      entityType: "key_result",
      entityId: keyResult.id,
      after: keyResult,
    });
    return keyResult;
  });
}

export async function updateKeyResult(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findKeyResult(tx, context, id);
    assertDateRange(data.startDate ?? before.startDate, data.dueDate ?? before.dueDate);
    assertIos(
      String(data.baseline ?? before.baseline) !== String(data.target ?? before.target),
      400,
      "IOS_KEY_RESULT_TARGET_EQUALS_BASELINE",
      "O alvo do resultado-chave deve ser diferente do baseline."
    );
    if (data.metricId) await findMetric(tx, context, data.metricId);
    await ensureMember(tx, context, data.ownerId);
    const after = await tx.iosKeyResult.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.key_result.update",
      entityType: "key_result",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function cancelKeyResult(context, id) {
  return updateKeyResult(context, id, { status: "CANCELED" });
}

export async function createInitiative(context, cycleId, data) {
  return prisma.$transaction(async (tx) => {
    await findCycle(tx, context, cycleId);
    await ensureObjectiveInCycle(tx, context, data.objectiveId, cycleId);
    await ensureMember(tx, context, data.ownerId);
    const initiative = await tx.iosInitiative.create({
      data: {
        ...data,
        cycleId,
        ownerId: data.ownerId ?? context.membership.id,
      },
    });
    await audit(tx, context, {
      action: "ios.initiative.create",
      entityType: "initiative",
      entityId: initiative.id,
      after: initiative,
    });
    return initiative;
  });
}

export async function updateInitiative(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findInitiative(tx, context, id);
    const startDate = data.startDate === undefined ? before.startDate : data.startDate;
    const dueDate = data.dueDate === undefined ? before.dueDate : data.dueDate;
    if (startDate && dueDate) assertDateRange(startDate, dueDate);
    await ensureObjectiveInCycle(tx, context, data.objectiveId, before.cycleId);
    await ensureMember(tx, context, data.ownerId);
    const after = await tx.iosInitiative.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.initiative.update",
      entityType: "initiative",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function createMilestone(context, initiativeId, data) {
  return prisma.$transaction(async (tx) => {
    await findInitiative(tx, context, initiativeId);
    const milestone = await tx.iosMilestone.create({
      data: { ...data, initiativeId },
    });
    await audit(tx, context, {
      action: "ios.milestone.create",
      entityType: "milestone",
      entityId: milestone.id,
      after: milestone,
      metadata: { initiativeId },
    });
    return milestone;
  });
}

export async function updateMilestone(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findMilestone(tx, context, id);
    const normalized = {
      ...data,
      completedAt: data.status === "COMPLETED"
        ? (before.completedAt ?? new Date())
        : data.status
          ? null
          : undefined,
    };
    const after = await tx.iosMilestone.update({ where: { id }, data: normalized });
    await audit(tx, context, {
      action: "ios.milestone.update",
      entityType: "milestone",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function linkTask(context, initiativeId, taskId) {
  return prisma.$transaction(async (tx) => {
    await findInitiative(tx, context, initiativeId);
    const task = await tx.adminTask.findUnique({ where: { id: taskId } });
    assertIos(task, 404, "IOS_TASK_NOT_FOUND", "Task não encontrada.");
    const link = await tx.iosInitiativeTaskLink.upsert({
      where: { initiativeId_taskId: { initiativeId, taskId } },
      create: { initiativeId, taskId, linkedBy: context.actor.id },
      update: {},
      include: {
        task: {
          select: { id: true, number: true, title: true, status: true, priority: true, dueDate: true },
        },
      },
    });
    await audit(tx, context, {
      action: "ios.initiative.task_link",
      entityType: "initiative",
      entityId: initiativeId,
      after: link,
      metadata: { taskId, taskNumber: task.number },
    });
    return link;
  });
}

export async function unlinkTask(context, initiativeId, taskId) {
  return prisma.$transaction(async (tx) => {
    await findInitiative(tx, context, initiativeId);
    const before = await tx.iosInitiativeTaskLink.findUnique({
      where: { initiativeId_taskId: { initiativeId, taskId } },
    });
    assertIos(before, 404, "IOS_TASK_LINK_NOT_FOUND", "Vínculo com a task não encontrado.");
    await tx.iosInitiativeTaskLink.delete({
      where: { initiativeId_taskId: { initiativeId, taskId } },
    });
    await audit(tx, context, {
      action: "ios.initiative.task_unlink",
      entityType: "initiative",
      entityId: initiativeId,
      before,
      metadata: { taskId },
    });
    return { ok: true };
  });
}

export async function listDecisions(context) {
  const organization = requireWorkspace(context);
  return prisma.iosDecision.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createDecision(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    if (data.cycleId) await findCycle(tx, context, data.cycleId);
    if (data.objectiveId) {
      const objective = await findObjective(tx, context, data.objectiveId);
      if (data.cycleId) {
        assertIos(
          objective.cycleId === data.cycleId,
          409,
          "IOS_DECISION_RELATION_MISMATCH",
          "Objetivo e ciclo da decisão não correspondem."
        );
      }
    }
    const decision = await tx.iosDecision.create({
      data: {
        ...data,
        organizationId: organization.id,
        createdBy: context.actor.id,
      },
    });
    await audit(tx, context, {
      action: "ios.decision.create",
      entityType: "decision",
      entityId: decision.id,
      after: decision,
    });
    return decision;
  });
}

export async function updateDecision(context, id, data) {
  return prisma.$transaction(async (tx) => {
    const before = await findDecision(tx, context, id);
    if (data.cycleId) await findCycle(tx, context, data.cycleId);
    if (data.objectiveId) {
      const objective = await findObjective(tx, context, data.objectiveId);
      const cycleId = data.cycleId ?? before.cycleId;
      if (cycleId) {
        assertIos(
          objective.cycleId === cycleId,
          409,
          "IOS_DECISION_RELATION_MISMATCH",
          "Objetivo e ciclo da decisão não correspondem."
        );
      }
    }
    const after = await tx.iosDecision.update({ where: { id }, data });
    await audit(tx, context, {
      action: "ios.decision.update",
      entityType: "decision",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function getAudit(context, { take = 100, entityType } = {}) {
  const organization = requireWorkspace(context);
  return prisma.iosAuditLog.findMany({
    where: {
      organizationId: organization.id,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(take) || 100, 1), 300),
  });
}

export async function getCockpit(context) {
  const organization = requireWorkspace(context);
  const [activeCycle, metrics, decisions, auditLogs] = await Promise.all([
    prisma.iosStrategyCycle.findFirst({
      where: {
        organizationId: organization.id,
        status: { in: ["ACTIVE", "DRAFT"] },
      },
      include: cycleInclude,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.iosMetricDefinition.findMany({
      where: { organizationId: organization.id, isActive: true },
      include: metricInclude,
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.iosDecision.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.iosAuditLog.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const cycle = serializeCycle(activeCycle);
  const objectives = cycle?.objectives ?? [];
  const initiatives = cycle?.initiatives ?? [];
  return {
    workspace: organization,
    activeCycle: cycle,
    summary: {
      objectives: objectives.length,
      onTrack: objectives.filter((item) => ["ACTIVE", "COMPLETED"].includes(item.status)).length,
      atRisk: objectives.filter((item) => item.status === "AT_RISK").length,
      initiatives: initiatives.length,
      blockedInitiatives: initiatives.filter((item) => item.status === "BLOCKED").length,
      pendingMilestones: initiatives
        .flatMap((item) => item.milestones)
        .filter((item) => item.status === "PENDING").length,
    },
    objectives,
    metrics: metrics.map(serializeMetric),
    recentDecisions: decisions,
    audit: auditLogs,
  };
}
