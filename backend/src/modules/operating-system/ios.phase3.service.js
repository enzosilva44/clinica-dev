import { prisma } from "../../config/prisma.js";
import { iosAuditData } from "./ios.audit.js";
import { computePipelineSummary, percentage, round } from "./ios.analytics.js";
import { assertIos } from "./ios.errors.js";

function requireWorkspace(context) {
  assertIos(
    context.organization && context.membership?.isActive,
    409,
    "IOS_NOT_INITIALIZED",
    "Inicialize o IASO Operating System antes de continuar."
  );
  return context.organization;
}

async function ensureChannel(tx, organizationId, id) {
  if (!id) return;
  const row = await tx.iosCommercialChannel.findFirst({ where: { id, organizationId } });
  assertIos(row, 400, "IOS_CHANNEL_NOT_FOUND", "Canal comercial inválido.");
}

async function ensurePartner(tx, organizationId, id) {
  if (!id) return;
  const row = await tx.iosPartner.findFirst({ where: { id, organizationId } });
  assertIos(row, 400, "IOS_PARTNER_NOT_FOUND", "Parceiro inválido.");
}

async function ensureLead(tx, id) {
  if (!id) return;
  const row = await tx.lead.findUnique({ where: { id } });
  assertIos(row, 400, "IOS_LEAD_NOT_FOUND", "Lead inválido.");
}

async function ensureAdminUser(tx, id) {
  if (!id) return;
  const row = await tx.user.findFirst({ where: { id, role: "ADMIN" } });
  assertIos(row, 400, "IOS_ADMIN_USER_NOT_FOUND", "O ocupante deve ser um usuário administrador.");
}

export async function getCommercialOverview(context) {
  const organization = requireWorkspace(context);
  const [leads, channels, campaigns, partners, commissions] = await Promise.all([
    prisma.lead.findMany({
      include: {
        stageHistory: { orderBy: { changedAt: "desc" }, take: 10 },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.iosCommercialChannel.findMany({
      where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    }),
    prisma.iosCampaign.findMany({
      where: { organizationId: organization.id, status: { not: "CANCELED" } },
      include: { channel: true },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    prisma.iosPartner.findMany({
      where: { organizationId: organization.id, status: { not: "ENDED" } },
      orderBy: { name: "asc" },
    }),
    prisma.iosCommission.findMany({
      where: { organizationId: organization.id, status: { not: "CANCELED" } },
      include: {
        partner: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, clinicName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const pipeline = computePipelineSummary(leads);
  const sourceMap = new Map();
  for (const lead of leads) {
    const source = lead.source || "Não informado";
    const current = sourceMap.get(source) || { source, leads: 0, won: 0, lost: 0, value: 0 };
    current.leads += 1;
    current.value += Number(lead.value) || 0;
    if (lead.status === "fechado") current.won += 1;
    if (lead.status === "perdido") current.lost += 1;
    sourceMap.set(source, current);
  }
  const sources = [...sourceMap.values()]
    .map((item) => ({
      ...item,
      value: round(item.value),
      conversionRate: percentage(item.won, item.won + item.lost),
    }))
    .sort((a, b) => b.leads - a.leads);
  const commissionsSummary = commissions.reduce((summary, item) => {
    const amount = Number(item.amount) || 0;
    summary.total += amount;
    if (item.status === "PAID") summary.paid += amount;
    else summary.pending += amount;
    return summary;
  }, { total: 0, paid: 0, pending: 0 });

  return {
    pipeline,
    sources,
    leads,
    channels,
    campaigns,
    partners,
    commissions,
    commissionsSummary: Object.fromEntries(
      Object.entries(commissionsSummary).map(([key, value]) => [key, round(value)])
    ),
  };
}

const COMMERCIAL_RESOURCES = {
  channel: {
    delegate: "iosCommercialChannel",
    entityType: "commercial-channel",
  },
  campaign: {
    delegate: "iosCampaign",
    entityType: "campaign",
  },
  partner: {
    delegate: "iosPartner",
    entityType: "partner",
  },
  commission: {
    delegate: "iosCommission",
    entityType: "commission",
  },
};

export async function createCommercialRecord(context, resource, data) {
  const organization = requireWorkspace(context);
  const config = COMMERCIAL_RESOURCES[resource];
  assertIos(config, 404, "IOS_RESOURCE_NOT_FOUND", "Recurso comercial inválido.");
  return prisma.$transaction(async (tx) => {
    if (resource === "campaign") await ensureChannel(tx, organization.id, data.channelId);
    if (resource === "commission") {
      await ensurePartner(tx, organization.id, data.partnerId);
      await ensureLead(tx, data.leadId);
    }
    const row = await tx[config.delegate].create({
      data: { ...data, organizationId: organization.id },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: `ios.${config.entityType}.create`,
        entityType: config.entityType,
        entityId: row.id,
        after: row,
      }),
    });
    return row;
  });
}

export async function updateCommercialRecord(context, resource, id, data) {
  const organization = requireWorkspace(context);
  const config = COMMERCIAL_RESOURCES[resource];
  assertIos(config, 404, "IOS_RESOURCE_NOT_FOUND", "Recurso comercial inválido.");
  return prisma.$transaction(async (tx) => {
    const before = await tx[config.delegate].findFirst({
      where: { id, organizationId: organization.id },
    });
    assertIos(before, 404, "IOS_RECORD_NOT_FOUND", "Registro não encontrado.");
    if (resource === "campaign") await ensureChannel(tx, organization.id, data.channelId);
    if (resource === "commission") {
      await ensurePartner(tx, organization.id, data.partnerId);
      await ensureLead(tx, data.leadId);
      if (data.status === "PAID" && data.paidAt === undefined) data.paidAt = new Date();
    }
    const after = await tx[config.delegate].update({ where: { id }, data });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: `ios.${config.entityType}.update`,
        entityType: config.entityType,
        entityId: id,
        before,
        after,
      }),
    });
    return after;
  });
}

const releaseInclude = {
  taskLinks: {
    include: {
      task: {
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          area: true,
          dueDate: true,
        },
      },
    },
  },
};

export async function getProductOverview(context) {
  const organization = requireWorkspace(context);
  const [tasks, releases, snapshots] = await Promise.all([
    prisma.adminTask.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        area: true,
        dueDate: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.iosProductRelease.findMany({
      where: { organizationId: organization.id, status: { not: "CANCELED" } },
      include: releaseInclude,
      orderBy: [{ status: "asc" }, { plannedAt: "desc" }],
    }),
    prisma.iosProductAdoptionSnapshot.findMany({
      where: { organizationId: organization.id },
      orderBy: { periodEnd: "desc" },
      take: 200,
    }),
  ]);
  const byStatus = {};
  const byArea = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    const area = task.area || "Sem área";
    byArea[area] = (byArea[area] || 0) + 1;
  }
  const adoption = snapshots.map((item) => ({
    ...item,
    adoptionRate: percentage(item.activeUsers, item.eligibleUsers),
  }));
  return {
    summary: {
      tasks: tasks.length,
      completed: tasks.filter((task) => task.status === "concluido").length,
      activeReleases: releases.filter((release) => ["PLANNED", "IN_PROGRESS"].includes(release.status)).length,
      released: releases.filter((release) => release.status === "RELEASED").length,
    },
    byStatus,
    byArea,
    tasks,
    releases,
    adoption,
  };
}

export async function createRelease(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const release = await tx.iosProductRelease.create({
      data: { ...data, organizationId: organization.id, createdBy: context.actor.id },
      include: releaseInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.product-release.create",
        entityType: "product-release",
        entityId: release.id,
        after: release,
      }),
    });
    return release;
  });
}

export async function updateRelease(context, id, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const before = await tx.iosProductRelease.findFirst({
      where: { id, organizationId: organization.id },
      include: releaseInclude,
    });
    assertIos(before, 404, "IOS_RELEASE_NOT_FOUND", "Release não encontrada.");
    if (data.status === "RELEASED" && data.releasedAt === undefined) data.releasedAt = new Date();
    const after = await tx.iosProductRelease.update({
      where: { id },
      data,
      include: releaseInclude,
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.product-release.update",
        entityType: "product-release",
        entityId: id,
        before,
        after,
      }),
    });
    return after;
  });
}

export async function linkReleaseTask(context, releaseId, taskId) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const [release, task] = await Promise.all([
      tx.iosProductRelease.findFirst({ where: { id: releaseId, organizationId: organization.id } }),
      tx.adminTask.findUnique({ where: { id: taskId } }),
    ]);
    assertIos(release, 404, "IOS_RELEASE_NOT_FOUND", "Release não encontrada.");
    assertIos(task, 404, "IOS_TASK_NOT_FOUND", "Task não encontrada.");
    const link = await tx.iosProductReleaseTask.upsert({
      where: { releaseId_taskId: { releaseId, taskId } },
      create: { releaseId, taskId, linkedBy: context.actor.id },
      update: { linkedBy: context.actor.id, linkedAt: new Date() },
      include: { task: true },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.product-release.task-link",
        entityType: "product-release",
        entityId: releaseId,
        metadata: { taskId },
        after: link,
      }),
    });
    return link;
  });
}

export async function unlinkReleaseTask(context, releaseId, taskId) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const release = await tx.iosProductRelease.findFirst({
      where: { id: releaseId, organizationId: organization.id },
    });
    assertIos(release, 404, "IOS_RELEASE_NOT_FOUND", "Release não encontrada.");
    await tx.iosProductReleaseTask.delete({
      where: { releaseId_taskId: { releaseId, taskId } },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.product-release.task-unlink",
        entityType: "product-release",
        entityId: releaseId,
        metadata: { taskId },
      }),
    });
    return { ok: true };
  });
}

export async function createAdoptionSnapshot(context, data) {
  const organization = requireWorkspace(context);
  assertIos(
    data.activeUsers <= data.eligibleUsers,
    400,
    "IOS_ADOPTION_INVALID",
    "Usuários ativos não podem exceder usuários elegíveis."
  );
  return prisma.$transaction(async (tx) => {
    const row = await tx.iosProductAdoptionSnapshot.upsert({
      where: {
        organizationId_featureKey_periodStart_periodEnd: {
          organizationId: organization.id,
          featureKey: data.featureKey,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        },
      },
      create: {
        ...data,
        organizationId: organization.id,
        createdBy: context.actor.id,
      },
      update: {
        ...data,
        createdBy: context.actor.id,
        measuredAt: new Date(),
      },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.product-adoption.upsert",
        entityType: "product-adoption",
        entityId: row.id,
        after: row,
      }),
    });
    return { ...row, adoptionRate: percentage(row.activeUsers, row.eligibleUsers) };
  });
}

export async function getPeopleOverview(context) {
  const organization = requireWorkspace(context);
  const [team, positions] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.iosPosition.findMany({
      where: { organizationId: organization.id, status: { not: "CLOSED" } },
      include: {
        occupant: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ area: "asc" }, { title: "asc" }],
    }),
  ]);
  const current = positions.filter((position) => position.type === "CURRENT");
  const planned = positions.filter((position) => position.type === "PLANNED");
  const monthlyCost = current.reduce((sum, position) => sum + (Number(position.monthlyCost) || 0), 0);
  const plannedCost = planned.reduce((sum, position) => sum + (Number(position.monthlyCost) || 0), 0);
  const areas = {};
  for (const position of positions) {
    const area = areas[position.area] || { positions: 0, filled: 0, open: 0, capacity: 0 };
    area.positions += 1;
    if (position.status === "FILLED") area.filled += 1;
    if (position.status === "OPEN") area.open += 1;
    area.capacity += position.capacityPercent;
    areas[position.area] = area;
  }
  return {
    summary: {
      teamMembers: team.length,
      currentPositions: current.length,
      plannedPositions: planned.length,
      openPositions: positions.filter((position) => position.status === "OPEN").length,
      monthlyCost: round(monthlyCost),
      plannedMonthlyCost: round(plannedCost),
    },
    areas,
    team,
    positions,
  };
}

export async function createPosition(context, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    await ensureAdminUser(tx, data.occupantUserId);
    const normalized = {
      ...data,
      organizationId: organization.id,
      status: data.occupantUserId && data.status === "OPEN" ? "FILLED" : data.status,
    };
    const row = await tx.iosPosition.create({
      data: normalized,
      include: { occupant: { select: { id: true, name: true, email: true } } },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.position.create",
        entityType: "position",
        entityId: row.id,
        after: row,
      }),
    });
    return row;
  });
}

export async function updatePosition(context, id, data) {
  const organization = requireWorkspace(context);
  return prisma.$transaction(async (tx) => {
    const before = await tx.iosPosition.findFirst({
      where: { id, organizationId: organization.id },
      include: { occupant: true },
    });
    assertIos(before, 404, "IOS_POSITION_NOT_FOUND", "Posição não encontrada.");
    await ensureAdminUser(tx, data.occupantUserId);
    if (data.occupantUserId && data.status === undefined) data.status = "FILLED";
    const after = await tx.iosPosition.update({
      where: { id },
      data,
      include: { occupant: { select: { id: true, name: true, email: true } } },
    });
    await tx.iosAuditLog.create({
      data: iosAuditData(context, {
        action: "ios.position.update",
        entityType: "position",
        entityId: id,
        before,
        after,
      }),
    });
    return after;
  });
}
