import { prisma } from "../../config/prisma.js";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "../whatsapp/whatsapp.provider.js";

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
    metaTemplateName: "lembrete_consulta",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "data", "hora"],
  },
};

function interpolate(body, vars) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function ensureDefaultTemplates(userId) {
  const existing = await prisma.automationTemplate.findMany({ where: { userId } });
  const existingByType = new Map(existing.map((t) => [t.type, t]));
  for (const [type, data] of Object.entries(DEFAULT_TEMPLATES)) {
    const metaFields = {
      metaTemplateName: data.metaTemplateName ?? null,
      metaLanguage: data.metaLanguage ?? "pt_BR",
      metaVariables: data.metaVariables ?? [],
    };
    const current = existingByType.get(type);
    if (!current) {
      await prisma.automationTemplate.create({
        data: { type, name: data.name, body: data.body, isActive: true, userId, ...metaFields },
      });
    } else if (data.metaTemplateName && !current.metaTemplateName) {
      // Retrofit: clínicas que já tinham o template ganham o mapeamento Meta.
      await prisma.automationTemplate.update({
        where: { id: current.id },
        data: metaFields,
      });
    }
  }
}

async function getActiveTemplate(userId, type) {
  return prisma.automationTemplate.findFirst({
    where: { userId, type, isActive: true },
  });
}

async function logAndSend({ userId, patientId, patientName, phone, type, message, scheduledFor, templateId, tpl, vars }) {
  if (!phone) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });

  const config = {
    phoneNumberId: user?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken:   user?.whatsappAccessToken   || process.env.WHATSAPP_ACCESS_TOKEN,
  };

  if (!config.phoneNumberId || !config.accessToken) {
    await prisma.automationLog.create({
      data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "skipped" },
    });
    return;
  }

  const log = await prisma.automationLog.create({
    data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "pending" },
  });
  try {
    // Envio proativo (fora da janela de 24h) exige Message Template aprovado na Meta.
    // Se o template tem metaTemplateName, envia via template; senão, texto livre (janela/teste).
    if (tpl?.metaTemplateName) {
      const params = (tpl.metaVariables || []).map((key) => vars?.[key] ?? "");
      await sendWhatsAppTemplate(phone, tpl.metaTemplateName, params, {
        ...config,
        language: tpl.metaLanguage || "pt_BR",
      });
    } else {
      await sendWhatsAppMessage(phone, message, config);
    }
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
  const vars = { nome: patient.name.split(" ")[0] };
  const message = interpolate(tpl.body, vars);
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "welcome", message,
    scheduledFor: new Date(), templateId: tpl.id, tpl, vars,
  });
}

// Called when an appointment is created
export async function triggerConfirmation(userId, appointment, patient) {
  const tpl = await getActiveTemplate(userId, "confirmation");
  if (!tpl || !patient?.phone) return;
  const startsAt = new Date(appointment.startsAt);
  const data = startsAt.toLocaleDateString("pt-BR");
  const hora = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const vars = { nome: patient.name.split(" ")[0], data, hora };
  const message = interpolate(tpl.body, vars);
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "confirmation", message,
    scheduledFor: new Date(), templateId: tpl.id, tpl, vars,
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
      where: { userId, isActive: true, birthDate: { not: null } },
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

      const vars = { nome: p.name.split(" ")[0] };
      const message = interpolate(tpl.body, vars);
      await logAndSend({
        userId, patientId: p.id, patientName: p.name,
        phone: p.phone, type: "birthday", message,
        scheduledFor: now, templateId: tpl.id, tpl, vars,
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
      const vars = { nome: appt.patient.name.split(" ")[0], data, hora };
      const message = interpolate(tpl.body, vars);
      await logAndSend({
        userId, patientId: appt.patient.id, patientName: appt.patient.name,
        phone: appt.patient.phone, type: "reminder", message,
        scheduledFor: new Date(appt.startsAt), templateId: tpl.id, tpl, vars,
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
