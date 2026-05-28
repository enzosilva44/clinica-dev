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
