import { prisma } from "../../config/prisma.js";

// Visão unificada de "pacotes de sessões" das duas origens:
//  - CLUB: cada ClubPlanItem de um membro ativo é um pacote (contratado = quantity,
//          realizado = nº de ClubApplication daquele item).
//  - ORÇAMENTO: cada BudgetItem de um orçamento APROVADO é um pacote
//          (contratado = quantity, realizado = nº de BudgetSession).
// Pagamento é rastreado à parte (não bloqueia consumo) — expomos o vínculo mas
// deixamos a UI mostrar pago × realizado lado a lado.
export async function getOverview(userId, { patientId } = {}) {
  const memberWhere = { userId, status: "ativo" };
  if (patientId) memberWhere.patientId = patientId;

  const budgetWhere = { userId, status: "aprovado" };
  if (patientId) budgetWhere.patientId = patientId;

  const [members, budgets] = await Promise.all([
    prisma.clubMember.findMany({
      where: memberWhere,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        plan: { include: { items: true } },
        applications: { orderBy: { appliedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.budget.findMany({
      where: budgetWhere,
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        items: { include: { sessions: { orderBy: { performedAt: "desc" } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const packages = [];

  for (const member of members) {
    for (const item of member.plan.items) {
      const sessions = member.applications
        .filter((a) => a.planItemId === item.id)
        .map((a) => ({
          id: a.id,
          performedAt: a.appliedAt,
          appointmentId: a.appointmentId,
          notes: a.notes,
        }));
      packages.push({
        origin: "club",
        sourceId: member.id, // memberId
        itemId: item.id, // planItemId
        patient: member.patient,
        title: member.plan.name,
        procedureName: item.procedureName,
        contracted: item.quantity,
        done: sessions.length,
        remaining: Math.max(item.quantity - sessions.length, 0),
        sessions,
      });
    }
  }

  for (const budget of budgets) {
    for (const item of budget.items) {
      const sessions = item.sessions.map((s) => ({
        id: s.id,
        performedAt: s.performedAt,
        appointmentId: s.appointmentId,
        notes: s.notes,
      }));
      packages.push({
        origin: "budget",
        sourceId: budget.id, // budgetId
        itemId: item.id, // budgetItemId
        patient: budget.patient,
        title: budget.title,
        procedureName: item.procedureName,
        contracted: item.quantity,
        done: sessions.length,
        remaining: Math.max(item.quantity - sessions.length, 0),
        sessions,
      });
    }
  }

  return packages;
}
