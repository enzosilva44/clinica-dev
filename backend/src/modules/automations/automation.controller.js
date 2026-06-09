import {
  ensureDefaultTemplates,
  listTemplates,
  upsertTemplate,
  listLogs,
  runBirthdayCron,
  runReminderCron,
} from "./automation.service.js";
import { prisma } from "../../config/prisma.js";
import { sendWhatsAppMessage } from "../whatsapp/whatsapp.provider.js";

export async function getTemplates(req, res) {
  await ensureDefaultTemplates(req.user.id);
  const templates = await listTemplates(req.user.id);
  res.json(templates);
}

export async function saveTemplate(req, res) {
  const { type } = req.params;
  const { name, body, isActive, reminderHoursBefore } = req.body;
  const tpl = await upsertTemplate(req.user.id, type, {
    name, body,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    ...(reminderHoursBefore != null ? { reminderHoursBefore: parseInt(reminderHoursBefore) } : {}),
  });
  res.json(tpl);
}

export async function getLogs(req, res) {
  const { page = 1, limit = 20, type } = req.query;
  const result = await listLogs(req.user.id, { page: +page, limit: +limit, type });
  res.json(result);
}

export async function notifyCustom(req, res) {
  const { phone, message, patientId, patientName, type = "confirmation" } = req.body;
  if (!phone || !message) return res.status(400).json({ error: "phone e message são obrigatórios" });

  const log = await prisma.automationLog.create({
    data: {
      userId: req.user.id,
      patientId: patientId || null,
      patientName: patientName || "—",
      phone, type, message,
      scheduledFor: new Date(),
      status: "pending",
    },
  });

  try {
    await sendWhatsAppMessage(phone, message);
    await prisma.automationLog.update({ where: { id: log.id }, data: { status: "sent", sentAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    await prisma.automationLog.update({ where: { id: log.id }, data: { status: "failed", error: err.message } });
    res.status(500).json({ error: err.message });
  }
}

export async function triggerManual(req, res) {
  const { type } = req.params;
  if (type === "birthday") await runBirthdayCron();
  else if (type === "reminder") await runReminderCron();
  else return res.status(400).json({ error: "Tipo inválido" });
  res.json({ ok: true });
}

export async function getWhatsappConfig(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });
  res.json({
    configured: !!(user?.whatsappPhoneNumberId && user?.whatsappAccessToken),
    phoneNumberId: user?.whatsappPhoneNumberId || "",
    hasToken: !!user?.whatsappAccessToken,
  });
}

export async function saveWhatsappConfig(req, res) {
  const { phoneNumberId, accessToken } = req.body;
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      whatsappPhoneNumberId: phoneNumberId || null,
      whatsappAccessToken: accessToken || null,
    },
  });
  res.json({ ok: true });
}

export async function testWhatsapp(req, res) {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone é obrigatório" });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
  });

  const config = {
    phoneNumberId: user?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken:   user?.whatsappAccessToken   || process.env.WHATSAPP_ACCESS_TOKEN,
  };

  if (!config.phoneNumberId || !config.accessToken) {
    return res.status(400).json({ error: "WhatsApp não configurado" });
  }

  try {
    await sendWhatsAppMessage(phone, "✅ Teste de conexão do Iasoclin. WhatsApp configurado com sucesso!", config);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUsageStats(req, res) {
  const userId = req.user.id;
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const next30 = new Date(now);
  next30.setDate(next30.getDate() + 30);

  const [todayLogs, monthLogs, patients, upcomingAppointments] = await Promise.all([
    prisma.automationLog.findMany({
      where: { userId, status: "sent", sentAt: { gte: todayStart } },
      select: { phone: true, type: true },
    }),
    prisma.automationLog.findMany({
      where: { userId, status: "sent", sentAt: { gte: monthStart, lte: monthEnd } },
      select: { phone: true, type: true },
    }),
    prisma.patient.findMany({
      where: { userId, isActive: true, birthDate: { not: null } },
      select: { birthDate: true },
    }),
    prisma.appointment.count({
      where: { userId, startsAt: { gte: now, lte: next30 }, status: { not: "CANCELED" } },
    }),
  ]);

  // Each unique phone per day = 1 conversation (Meta's 24h window model)
  const todayConversations  = new Set(todayLogs.map(l => l.phone)).size;
  const monthConversations  = new Set(monthLogs.map(l => l.phone)).size;

  // Approximate Meta pricing for Brazil (marketing vs utility)
  const COST = { birthday: 0.50, welcome: 0.50, confirmation: 0.20, reminder: 0.20 };
  const monthCost = monthLogs.reduce((sum, l) => sum + (COST[l.type] ?? 0.20), 0);

  const monthByType = monthLogs.reduce((acc, l) => {
    acc[l.type] = (acc[l.type] || 0) + 1;
    return acc;
  }, {});

  // Birthdays remaining this month
  const birthdayMonth = now.getMonth() + 1;
  const birthdaysThisMonth = patients.filter(
    p => new Date(p.birthDate).getMonth() + 1 === birthdayMonth
  ).length;

  // Projected: each appointment generates confirmation + reminder (2 msgs, same conversation window → 1 conversation)
  const projectedConversations = birthdaysThisMonth + upcomingAppointments;
  const projectedCost = parseFloat(
    (birthdaysThisMonth * 0.50 + upcomingAppointments * 0.20).toFixed(2)
  );

  res.json({
    today: {
      conversations: todayConversations,
      messages: todayLogs.length,
    },
    thisMonth: {
      conversations: monthConversations,
      messages: monthLogs.length,
      byType: monthByType,
      estimatedCost: parseFloat(monthCost.toFixed(2)),
    },
    projections: {
      birthdaysThisMonth,
      upcomingAppointments30days: upcomingAppointments,
      estimatedConversations: projectedConversations,
      estimatedCost: projectedCost,
    },
  });
}
