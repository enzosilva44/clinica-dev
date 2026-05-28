import { prisma } from "../../config/prisma.js";
import { sendWhatsAppMessage } from "../whatsapp/whatsapp.provider.js";

const DEFAULT_TEMPLATES = {
  birthday: {
    name: "Feliz aniversário",
    body: "Olá {{nome}}! 🎂 A equipe da clínica deseja um feliz aniversário! Aproveite seu dia especial. 🎉",
  },
  welcome: {
    name: "Boas-vindas",
    body: "Olá {{nome}}! 😊 Seja muito bem-vindo(a) à nossa clínica. Estamos aqui para cuidar de você com todo carinho. Qualquer dúvida, é só chamar!",
  },
  confirmation: {
    name: "Confirmação de agendamento",
    body: "Olá {{nome}}! ✅ Seu agendamento está confirmado para {{data}} às {{hora}}. Aguardamos você! Caso precise reagendar, entre em contato.",
  },
  reminder: {
    name: "Lembrete de consulta",
    body: "Olá {{nome}}! 🔔 Lembrando que você tem uma consulta amanhã, {{data}} às {{hora}}. Te esperamos!",
  },
};

function interpolate(body, vars) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function ensureDefaultTemplates(userId) {
  const existing = await prisma.automationTemplate.findMany({ where: { userId } });
  const existingTypes = new Set(existing.map((t) => t.type));
  for (const [type, data] of Object.entries(DEFAULT_TEMPLATES)) {
    if (!existingTypes.has(type)) {
      await prisma.automationTemplate.create({
        data: { type, name: data.name, body: data.body, isActive: true, userId },
      });
    }
  }
}

async function getActiveTemplate(userId, type) {
  return prisma.automationTemplate.findFirst({
    where: { userId, type, isActive: true },
  });
}

async function logAndSend({ userId, patientId, patientName, phone, type, message, scheduledFor, templateId }) {
  if (!phone) return;
  const log = await prisma.automationLog.create({
    data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "pending" },
  });
  try {
    await sendWhatsAppMessage(phone, message);
    await prisma.automationLog.update({
      where: { id: log.id },
      data: { status: "sent", sentAt: new Date() },
    });
  } catch (err) {
    await prisma.automationLog.update({
      where: { id: log.id },
      data: { status: "failed", error: err.message },
    });
  }
}

// Called when a new patient is registered
export async function triggerWelcome(userId, patient) {
  const tpl = await getActiveTemplate(userId, "welcome");
  if (!tpl) return;
  const message = interpolate(tpl.body, { nome: patient.name.split(" ")[0] });
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "welcome", message,
    scheduledFor: new Date(), templateId: tpl.id,
  });
}

// Called when an appointment is created
export async function triggerConfirmation(userId, appointment, patient) {
  const tpl = await getActiveTemplate(userId, "confirmation");
  if (!tpl || !patient?.phone) return;
  const startsAt = new Date(appointment.startsAt);
  const data = startsAt.toLocaleDateString("pt-BR");
  const hora = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const message = interpolate(tpl.body, { nome: patient.name.split(" ")[0], data, hora });
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "confirmation", message,
    scheduledFor: new Date(), templateId: tpl.id,
  });
}

// Cron: run daily — send birthday messages
export async function runBirthdayCron() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Find all users and their active birthday template
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id: userId } of users) {
    const tpl = await getActiveTemplate(userId, "birthday");
    if (!tpl) continue;

    const patients = await prisma.patient.findMany({
      where: { userId, isActive: true, phone: { not: null }, birthDate: { not: null } },
      select: { id: true, name: true, phone: true, birthDate: true },
    });

    for (const p of patients) {
      const bd = new Date(p.birthDate);
      if (bd.getMonth() + 1 !== month || bd.getDate() !== day) continue;

      // Avoid duplicate within the same day
      const alreadySent = await prisma.automationLog.findFirst({
        where: {
          userId, patientId: p.id, type: "birthday",
          sentAt: { gte: new Date(now.getFullYear(), month - 1, day) },
          status: "sent",
        },
      });
      if (alreadySent) continue;

      const message = interpolate(tpl.body, { nome: p.name.split(" ")[0] });
      await logAndSend({
        userId, patientId: p.id, patientName: p.name,
        phone: p.phone, type: "birthday", message,
        scheduledFor: now, templateId: tpl.id,
      });
    }
  }
}

// Cron: run every 30 min — send appointment reminders
export async function runReminderCron() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id: userId } of users) {
    const tpl = await getActiveTemplate(userId, "reminder");
    if (!tpl) continue;
    const hours = tpl.reminderHoursBefore ?? 24;

    const windowStart = new Date(Date.now() + hours * 3600 * 1000 - 15 * 60 * 1000);
    const windowEnd   = new Date(Date.now() + hours * 3600 * 1000 + 15 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        userId,
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { not: "CANCELED" },
        patient: { phone: { not: null } },
      },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    });

    for (const appt of appointments) {
      const alreadySent = await prisma.automationLog.findFirst({
        where: { userId, patientId: appt.patient.id, type: "reminder", templateId: tpl.id,
          scheduledFor: { gte: windowStart, lte: windowEnd }, status: "sent" },
      });
      if (alreadySent) continue;

      const startsAt = new Date(appt.startsAt);
      const data = startsAt.toLocaleDateString("pt-BR");
      const hora = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const message = interpolate(tpl.body, { nome: appt.patient.name.split(" ")[0], data, hora });
      await logAndSend({
        userId, patientId: appt.patient.id, patientName: appt.patient.name,
        phone: appt.patient.phone, type: "reminder", message,
        scheduledFor: new Date(appt.startsAt), templateId: tpl.id,
      });
    }
  }
}

// CRUD helpers used by controller

export async function listTemplates(userId) {
  return prisma.automationTemplate.findMany({ where: { userId }, orderBy: { type: "asc" } });
}

export async function upsertTemplate(userId, type, data) {
  const existing = await prisma.automationTemplate.findFirst({ where: { userId, type } });
  if (existing) {
    return prisma.automationTemplate.update({ where: { id: existing.id }, data });
  }
  return prisma.automationTemplate.create({ data: { userId, type, ...data } });
}

export async function listLogs(userId, { page = 1, limit = 20, type } = {}) {
  const where = { userId, ...(type ? { type } : {}) };
  const [data, total] = await Promise.all([
    prisma.automationLog.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.automationLog.count({ where }),
  ]);
  return { data, total, totalPages: Math.ceil(total / limit) };
}
