import { prisma } from "../../config/prisma.js";

// Visão unificada de "pacotes de sessões" das duas origens:
//  - CLUB: cada ClubPlanItem de um membro ativo é um pacote (contratado = quantity,
//          realizado = nº de ClubApplication daquele item).
//  - ORÇAMENTO: cada orçamento-pacote APROVADO é UM pacote (contratado = sessionCount,
//          realizado = nº de BudgetSession). Uma sessão pode ter vários procedimentos;
//          os itens do orçamento são o escopo/inclusos, NÃO a contagem de sessões.
// Pagamento é rastreado à parte (não bloqueia consumo) — expomos o vínculo mas
// deixamos a UI mostrar pago × realizado lado a lado.
export async function getOverview(userId, { patientId } = {}) {
  const memberWhere = { userId, status: "ativo" };
  if (patientId) memberWhere.patientId = patientId;

  const budgetWhere = { userId, status: "aprovado", isPackage: true };
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
        items: true,
        sessions: { orderBy: { performedAt: "desc" } },
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
    const sessions = budget.sessions.map((s) => ({
      id: s.id,
      performedAt: s.performedAt,
      appointmentId: s.appointmentId,
      procedures: s.procedures || null,
      notes: s.notes,
    }));
    // Escopo do pacote: procedimentos inclusos (nomes dos itens do orçamento).
    const includedProcedures = budget.items.map((i) => i.procedureName);
    packages.push({
      origin: "budget",
      sourceId: budget.id, // budgetId
      itemId: budget.id, // pacote é o próprio orçamento (consumo por budgetId)
      patient: budget.patient,
      title: budget.title,
      procedureName: includedProcedures.join(", ") || budget.title,
      includedProcedures,
      contracted: budget.sessionCount,
      done: sessions.length,
      remaining: Math.max(budget.sessionCount - sessions.length, 0),
      sessions,
    });
  }

  return packages;
}
