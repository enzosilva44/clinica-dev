import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";

// ─── PLANOS ──────────────────────────────────────────────────────────────────

export async function findAllPlans(userId) {
  return prisma.clubPlan.findMany({
    where: { userId, isActive: true },
    include: { items: true, _count: { select: { members: { where: { status: "ativo" } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPlan(userId, data) {
  return prisma.clubPlan.create({
    data: {
      name: data.name,
      description: data.description || null,
      price: Number(data.price ?? 0),
      billingCycle: data.billingCycle || "mensal",
      userId,
      items: {
        create: (data.items || []).map((item) => ({
          procedureName: item.procedureName,
          quantity: Number(item.quantity ?? 1),
          intervalMonths: Number(item.intervalMonths ?? 12),
        })),
      },
    },
    include: { items: true },
  });
}

export async function updatePlan(id, userId, data) {
  const plan = await prisma.clubPlan.findFirst({ where: { id, userId } });
  if (!plan) throw new Error("Plano não encontrado");

  // Recria os itens do plano
  await prisma.clubPlanItem.deleteMany({ where: { planId: id } });

  return prisma.clubPlan.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      price: Number(data.price ?? 0),
      billingCycle: data.billingCycle || "mensal",
      items: {
        create: (data.items || []).map((item) => ({
          procedureName: item.procedureName,
          quantity: Number(item.quantity ?? 1),
          intervalMonths: Number(item.intervalMonths ?? 12),
        })),
      },
    },
    include: { items: true },
  });
}

export async function deletePlan(id, userId) {
  const plan = await prisma.clubPlan.findFirst({ where: { id, userId } });
  if (!plan) throw new Error("Plano não encontrado");
  return prisma.clubPlan.update({ where: { id }, data: { isActive: false } });
}

// ─── MEMBROS ─────────────────────────────────────────────────────────────────

// Anexa saldo (contratado − realizado = restante) por item do plano a cada membro.
function withBalances(member) {
  const items = member.plan.items.map((item) => {
    const done = member.applications.filter((a) => a.planItemId === item.id).length;
    return {
      ...item,
      contracted: item.quantity,
      done,
      remaining: Math.max(item.quantity - done, 0),
    };
  });
  return { ...member, plan: { ...member.plan, items } };
}

export async function findAllMembers(userId, filters = {}) {
  const where = { userId };
  if (filters.status) where.status = filters.status;

  const members = await prisma.clubMember.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true, phone: true } },
      plan: { include: { items: true } },
      applications: { orderBy: { appliedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return members.map(withBalances);
}

export async function createMember(userId, data) {
  const plan = await prisma.clubPlan.findFirst({ where: { id: data.planId, userId } });
  if (!plan) throw new Error("Plano não encontrado");

  const member = await prisma.clubMember.create({
    data: {
      patientId: data.patientId,
      planId: data.planId,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: "ativo",
      paymentMethod: data.paymentMethod || null,
      notes: data.notes || null,
      userId,
    },
    include: {
      patient: { select: { id: true, name: true } },
      plan: true,
    },
  });

  // Gera cobrança pendente no financeiro
  if (plan.price > 0) {
    await createPending(userId, {
      description: `Clube: ${plan.name} — ${member.patient.name}`,
      amount: plan.price,
      patientId: data.patientId,
    });
  }

  return member;
}

export async function updateMemberStatus(id, userId, status) {
  const member = await prisma.clubMember.findFirst({ where: { id, userId } });
  if (!member) throw new Error("Membro não encontrado");
  return prisma.clubMember.update({ where: { id }, data: { status } });
}

// ─── APLICAÇÕES ──────────────────────────────────────────────────────────────

export async function registerApplication(memberId, userId, data) {
  const member = await prisma.clubMember.findFirst({
    where: { id: memberId, userId },
    include: { plan: { include: { items: true } } },
  });
  if (!member) throw new Error("Membro não encontrado");

  const planItem = member.plan.items.find((i) => i.id === data.planItemId);
  if (!planItem) throw new Error("Item do plano não encontrado");

  const appliedAt = data.appliedAt ? new Date(data.appliedAt) : new Date();
  const nextDueAt = new Date(appliedAt);
  nextDueAt.setMonth(nextDueAt.getMonth() + planItem.intervalMonths);

  return prisma.clubApplication.create({
    data: {
      memberId,
      planItemId: data.planItemId,
      appointmentId: data.appointmentId || null,
      appliedAt,
      nextDueAt,
      notes: data.notes || null,
    },
  });
}

// Remove uma aplicação (devolve saldo). Valida ownership via member.
export async function removeApplication(id, userId) {
  const app = await prisma.clubApplication.findFirst({
    where: { id, member: { userId } },
  });
  if (!app) throw new Error("Aplicação não encontrada");
  return prisma.clubApplication.delete({ where: { id } });
}

// ─── ALERTAS ─────────────────────────────────────────────────────────────────

export async function getAlerts(userId) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Membros ativos com planos
  const members = await prisma.clubMember.findMany({
    where: { userId, status: "ativo" },
    include: {
      patient: { select: { id: true, name: true, phone: true } },
      plan: { include: { items: true } },
      applications: { orderBy: { appliedAt: "desc" } },
    },
  });

  const alerts = [];

  for (const member of members) {
    for (const item of member.plan.items) {
      // Última aplicação deste item
      const lastApplication = member.applications.find(
        (a) => a.planItemId === item.id
      );

      let nextDueAt;
      if (lastApplication) {
        nextDueAt = new Date(lastApplication.nextDueAt);
      } else {
        // Nunca aplicado — primeira aplicação deveria ser desde o início
        nextDueAt = new Date(member.startDate);
        nextDueAt.setMonth(nextDueAt.getMonth() + item.intervalMonths);
      }

      const today = new Date();
      const daysUntilDue = Math.ceil((nextDueAt - today) / (1000 * 60 * 60 * 24));

      // Alerta se vence em até 30 dias ou já está vencido
      if (daysUntilDue <= 30) {
        alerts.push({
          memberId: member.id,
          patientId: member.patient.id,
          patientName: member.patient.name,
          patientPhone: member.patient.phone,
          planName: member.plan.name,
          planItemId: item.id,
          procedureName: item.procedureName,
          quantity: item.quantity,
          intervalMonths: item.intervalMonths,
          lastAppliedAt: lastApplication?.appliedAt || null,
          nextDueAt,
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
        });
      }
    }
  }

  // Ordena: vencidos primeiro, depois por proximidade
  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
