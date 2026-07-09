import { prisma } from "../../config/prisma.js";
import { createPending } from "../financial/transaction.service.js";
import * as stockRequestService from "../products/stockRequest.service.js";

const COMPLETED_STATUSES = ["COMPLETED", "FINISHED"];

// Baixa de estoque ao concluir agendamento: 1 StockRequest pendente por material
// dos procedimentos do agendamento. Idempotente via marcador no `reason`
// (StockRequest não tem coluna appointmentId própria).
async function requestStockForAppointment(appt, userId) {
  const marker = `[appt:${appt.id}]`;
  const already = await prisma.stockRequest.findFirst({
    where: { userId, reason: { contains: marker } },
  });
  if (already) return;

  const procedureIds = (appt.procedures || [])
    .map((p) => p.procedureId)
    .filter(Boolean);
  if (procedureIds.length === 0) return;

  const procedures = await prisma.procedure.findMany({
    where: { id: { in: procedureIds }, userId },
    include: { products: { include: { product: true } } },
  });

  for (const proc of procedures) {
    for (const pp of proc.products) {
      if (!pp.productId || !pp.quantity) continue;
      await stockRequestService.create(userId, {
        type: "saida",
        productId: pp.productId,
        quantity: pp.quantity,
        reason: `Agendamento concluído — ${appt.title} ${marker}`,
      }).catch(() => null);
    }
  }
}

// Consome 1 sessão do pacote vinculado ao agendamento (ao concluir).
// Idempotente: se já existe uma sessão criada por este appointment, não duplica.
async function consumePackageSession(appt, userId) {
  if (!appt.packageOrigin || !appt.packageItemId) return;

  if (appt.packageOrigin === "budget") {
    // packageItemId guarda o budgetId (o pacote é o próprio orçamento).
    const already = await prisma.budgetSession.findFirst({
      where: { appointmentId: appt.id, budgetId: appt.packageItemId },
    });
    if (already) return;
    const budget = await prisma.budget.findFirst({
      where: { id: appt.packageItemId, userId, status: "aprovado", isPackage: true },
      include: { _count: { select: { sessions: true } } },
    });
    if (!budget || budget._count.sessions >= budget.sessionCount) return;
    await prisma.budgetSession.create({
      data: {
        budgetId: appt.packageItemId,
        appointmentId: appt.id,
        performedAt: new Date(),
      },
    });
  } else if (appt.packageOrigin === "club" && appt.packageMemberId) {
    const already = await prisma.clubApplication.findFirst({
      where: { appointmentId: appt.id, planItemId: appt.packageItemId },
    });
    if (already) return;
    const member = await prisma.clubMember.findFirst({
      where: { id: appt.packageMemberId, userId },
      include: { plan: { include: { items: true } } },
    });
    const planItem = member?.plan.items.find((i) => i.id === appt.packageItemId);
    if (!member || !planItem) return;
    const done = await prisma.clubApplication.count({
      where: { memberId: member.id, planItemId: planItem.id },
    });
    if (done >= planItem.quantity) return;
    const appliedAt = new Date();
    const nextDueAt = new Date(appliedAt);
    nextDueAt.setMonth(nextDueAt.getMonth() + planItem.intervalMonths);
    await prisma.clubApplication.create({
      data: {
        memberId: member.id,
        planItemId: planItem.id,
        appointmentId: appt.id,
        appliedAt,
        nextDueAt,
      },
    });
  }
}

// Devolve a sessão que este agendamento havia consumido (ao cancelar/reabrir).
async function releasePackageSession(appointmentId) {
  await prisma.budgetSession.deleteMany({ where: { appointmentId } });
  await prisma.clubApplication.deleteMany({ where: { appointmentId } });
}

// Normaliza a lista de procedimentos vinda do front em itens {procedureId, procedureName, quantity, unitPrice, total}.
// Compatibilidade: se não vier `procedures` mas vier `procedureType` (formato antigo),
// busca o preço pelo nome (como o código legado fazia) e devolve um único item.
async function normalizeProcedures(data, userId) {
  let items = Array.isArray(data.procedures) ? data.procedures : null;

  if ((!items || items.length === 0) && data.procedureType) {
    const proc = await prisma.procedure.findFirst({
      where: { name: data.procedureType, userId },
    });
    items = [{ procedureName: data.procedureType, procedureId: proc?.id ?? null, quantity: 1, unitPrice: proc?.price ?? 0 }];
  }

  if (!items || items.length === 0) return [];

  return items
    .filter((i) => i && (i.procedureName || i.procedureId))
    .map((i) => {
      const quantity = Number(i.quantity) > 0 ? Number(i.quantity) : 1;
      const unitPrice = Number(i.unitPrice) >= 0 ? Number(i.unitPrice) : 0;
      return {
        procedureId: i.procedureId || null,
        procedureName: i.procedureName || "",
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });
}

export async function create(data, user) {
  const category = data.category || "consulta";
  // Lembrete e compromisso pessoal podem não ter paciente vinculado.
  const requiresPatient = category === "consulta" || category === "retorno";

  if (data.patientId) {
    const patientExists = await prisma.patient.findFirst({
      where: { id: data.patientId, userId: user.id, isActive: true },
    });
    if (!patientExists) throw new Error("Paciente não encontrado");
  } else if (requiresPatient) {
    throw new Error("Paciente é obrigatório para consultas e retornos.");
  }

  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  const idempotencyKey = data.idempotencyKey || null;

  // Múltiplos procedimentos: normaliza a lista e deriva o procedureType (1º item) p/ compat.
  const procItems = await normalizeProcedures(data, user.id);
  const procedureType = procItems[0]?.procedureName || data.procedureType || null;
  const proceduresTotal = procItems.reduce((s, i) => s + i.total, 0);

  // Se já existe um appointment com essa idempotencyKey, retorna ele (request repetida)
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey },
      include: { patient: true },
    });
    if (existing) return existing;
  }

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        title: data.title,
        description: data.description,
        startsAt,
        endsAt,
        professional: data.professional,
        procedureType,
        notes: data.notes,
        status: data.status || "SCHEDULED",
        color: data.color,
        idempotencyKey,
        category,
        isAllDay: data.isAllDay ?? false,
        recurrenceRule: data.recurrenceRule || null,
        parentAppointmentId: data.parentAppointmentId || null,
        packageOrigin: data.packageOrigin || null,
        packageItemId: data.packageItemId || null,
        packageMemberId: data.packageMemberId || null,
        ...(procItems.length > 0 ? { procedures: { create: procItems } } : {}),
        ...(data.patientId ? { patient: { connect: { id: data.patientId } } } : {}),
        user: { connect: { id: user.id } },
      },
      include: { patient: true, procedures: true },
    });
  } catch (error) {
    // P2002 = violação de constraint única (race condition: outra request criou primeiro)
    if (error.code === "P2002" && idempotencyKey) {
      const existing = await prisma.appointment.findUnique({
        where: { idempotencyKey },
        include: { patient: true },
      });
      if (existing) return existing;
    }
    throw error;
  }

  // Se já nasce concluído com vínculo de pacote, consome a sessão.
  if (COMPLETED_STATUSES.includes(appointment.status)) {
    await consumePackageSession(appointment, user.id);
    await requestStockForAppointment(appointment, user.id);
  }

  // Lembrete e compromisso pessoal não geram cobrança.
  if (!requiresPatient) {
    return appointment;
  }

  // Valor sugerido = soma dos procedimentos do atendimento.
  const amount = proceduresTotal;

  // Sugestão de retorno: usa o 1º procedimento do atendimento que exija retorno.
  let suggestedReturn = null;
  if (category !== "retorno" && procItems.length > 0) {
    const names = procItems.map((i) => i.procedureName).filter(Boolean);
    const withReturn = await prisma.procedure.findFirst({
      where: { name: { in: names }, userId: user.id, requiresReturn: true },
    });
    if (withReturn) {
      const days = withReturn.returnDays ?? 0;
      const returnDate = new Date(startsAt);
      returnDate.setDate(returnDate.getDate() + days);
      suggestedReturn = { date: returnDate.toISOString(), days, procedureName: withReturn.name };
    }
  }

  // Descrição financeira: lista os procedimentos (ex: "Botox +1") ou cai no título.
  const description =
    procItems.length > 0
      ? procItems[0].procedureName + (procItems.length > 1 ? ` +${procItems.length - 1}` : "")
      : appointment.procedureType || appointment.title;

  await createPending(user.id, {
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    description,
    amount: data.txAmount !== undefined ? Number(data.txAmount) : amount,
    paymentMethod: data.txPaymentMethod || null,
    installments: data.txInstallments ? Number(data.txInstallments) : 1,
    dueDate: data.txDueDate || null,
    notes: data.txNotes || `Agendamento criado em ${new Date(appointment.startsAt).toLocaleDateString("pt-BR")} com ${appointment.professional || "profissional não informado"}.`,
    settlementType: data.txSettlementType || null,
  });

  return { ...appointment, suggestedReturn };
}

export async function findAll(user) {
  const appointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
    },

    include: {
      patient: true,
      transaction: true,
      procedures: true,
    },

    orderBy: {
      startsAt: "asc",
    },
  });

  return appointments;
}

// Cores por categoria de agendamento / tipo financeiro
const CALENDAR_COLORS = {
  consulta:    "#00704A",
  retorno:     "#2E6FA8",
  lembrete:    "#CBA258",
  compromisso: "#6F7F73",
  bloqueio:    "#8A8A8A",
  receivable:  "#1E9E5A",
  payable:     "#D9534F",
};

// Calendário unificado: agendamentos + itens financeiros (a receber / a pagar)
// types: lista de categorias/tipos a incluir. Se vazio, inclui tudo.
export async function getCalendar(user, { from, to, types } = {}) {
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  const hasRange = from || to;

  const include = (t) => !types || types.length === 0 || types.includes(t);
  const events = [];

  // ── Agendamentos ──
  const apptCategories = ["consulta", "retorno", "lembrete", "compromisso", "bloqueio"].filter(include);
  if (apptCategories.length > 0) {
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: user.id,
        category: { in: apptCategories },
        ...(hasRange ? { startsAt: range } : {}),
      },
      include: { patient: true, procedures: true },
      orderBy: { startsAt: "asc" },
    });
    for (const a of appointments) {
      events.push({
        id: a.id,
        kind: "appointment",
        category: a.category,
        title: a.title || a.patient?.name || a.procedureType || "Agendamento",
        patientName: a.patient?.name ?? null,
        start: a.startsAt,
        end: a.endsAt,
        isAllDay: a.isAllDay,
        color: a.color || CALENDAR_COLORS[a.category] || CALENDAR_COLORS.consulta,
        status: a.status,
        procedures: a.procedures ?? [],
      });
    }
  }

  // ── Financeiro (a receber / a pagar) — plotado pela dueDate ──
  const wantReceivable = include("receivable");
  const wantPayable = include("payable");
  if (wantReceivable || wantPayable) {
    const txTypes = [];
    if (wantReceivable) txTypes.push("receita");
    if (wantPayable) txTypes.push("despesa");
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: { in: txTypes },
        dueDate: hasRange ? range : { not: null },
      },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    });
    for (const t of transactions) {
      const isReceivable = t.type === "receita";
      // Transação só tem data (dueDate), guardada como meia-noite UTC. Lemos os
      // componentes em UTC e plotamos ao meio-dia UTC (09h no horário do Brasil)
      // para o item cair no DIA CORRETO da grade, sem deslocamento por fuso.
      const due = new Date(t.dueDate);
      const start = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 12, 0, 0));
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      events.push({
        id: `tx-${t.id}`,
        kind: isReceivable ? "receivable" : "payable",
        category: isReceivable ? "receivable" : "payable",
        title: `${isReceivable ? "A receber" : "A pagar"}: ${t.description}`,
        patientName: t.patient?.name ?? null,
        start,
        end,
        isAllDay: false,
        color: CALENDAR_COLORS[isReceivable ? "receivable" : "payable"],
        amount: t.amount,
        status: t.status,
        transactionId: t.id,
      });
    }
  }

  return events;
}

export async function findById(id, user) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      userId: user.id,
    },

    include: {
      patient: true,
      procedures: true,
    },
  });

  if (!appointment) {
    throw new Error("Agendamento não encontrado");
  }

  return appointment;
}

export async function findByPatient(patientId, userId) {
  return prisma.appointment.findMany({
    where: { patientId, userId },
    orderBy: { startsAt: "desc" },
    include: { procedures: true },
  });
}

export async function update(
  appointmentId,
  userId,
  data
) {
  const appointment =
    await prisma.appointment.findFirst({
      where: {
        id: appointmentId,

        userId,
      },
    });

  if (!appointment) {
    throw new Error(
      "Agendamento não encontrado"
    );
  }

  // Se o front mandou uma lista de procedimentos, substitui a atual (replace).
  const editingProcedures = Array.isArray(data.procedures);
  const procItems = editingProcedures ? await normalizeProcedures(data, userId) : null;
  // procedureType derivado do 1º item quando a lista foi editada; senão mantém o que veio.
  const procedureType = editingProcedures
    ? (procItems[0]?.procedureName || null)
    : data.procedureType;

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      title: data.title,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      professional: data.professional,
      procedureType,
      notes: data.notes,
      status: data.status,
      category: data.category,
      description: data.description,
      recurrenceRule: data.recurrenceRule,
      packageOrigin: data.packageOrigin !== undefined ? (data.packageOrigin || null) : undefined,
      packageItemId: data.packageItemId !== undefined ? (data.packageItemId || null) : undefined,
      packageMemberId: data.packageMemberId !== undefined ? (data.packageMemberId || null) : undefined,
      ...(editingProcedures
        ? { procedures: { deleteMany: {}, create: procItems } }
        : {}),
    },
    include: { patient: true, procedures: true },
  });

  // Consumo de pacote: concluir cria a sessão; cancelar/reabrir devolve o saldo.
  if (COMPLETED_STATUSES.includes(data.status)) {
    await consumePackageSession(updated, userId);
  } else if (data.status && !COMPLETED_STATUSES.includes(data.status)) {
    await releasePackageSession(updated.id);
  }

  // Ao concluir, cria transação pendente no financeiro (se ainda não existir).
  // createPending é idempotente por appointmentId (não duplica se já houver).
  if (data.status === "COMPLETED" || data.status === "FINISHED") {
    // Soma os procedimentos do agendamento; fallback p/ preço-por-nome legado.
    let amount = updated.procedures.reduce((s, p) => s + (p.total || 0), 0);
    if (amount === 0 && updated.procedureType) {
      const procedure = await prisma.procedure.findFirst({
        where: { name: updated.procedureType, userId },
      });
      if (procedure?.price) amount = procedure.price;
    }

    await createPending(userId, {
      appointmentId: updated.id,
      patientId: updated.patientId,
      description: updated.procedureType || updated.title,
      amount,
    });

    await requestStockForAppointment(updated, userId);
  }

  return updated;
}
