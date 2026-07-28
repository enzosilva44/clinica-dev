// Processa respostas de pacientes recebidas via webhook do WhatsApp.
// Como o número é compartilhado entre clínicas, cada resposta é atribuída à
// clínica pelo envio mais recente àquele telefone (automationLog).
import { prisma } from "../../config/prisma.js";
import { sendWhatsAppTemplate } from "../whatsapp/whatsapp.provider.js";
import { checkQuota, consumeQuota } from "../billing/quota.service.js";
import { apresentacaoClinica } from "./automation.service.js";

// Detecta a intenção a partir do texto do botão / mensagem livre.
function classifyReply({ buttonPayload, text }) {
  const t = (buttonPayload || text || "").toLowerCase();
  if (/confirm/.test(t)) return "confirm";
  if (/remarc|reagend|remarq/.test(t)) return "reschedule";
  return null;
}

// Normaliza telefone p/ comparação (só dígitos, com 55).
function normPhone(p) {
  let d = (p || "").replace(/\D/g, "");
  if (d && !d.startsWith("55")) d = "55" + d;
  return d;
}

// Acha a clínica (userId) + paciente pelo envio mais recente àquele telefone.
// Pega os últimos envios e casa pelo telefone normalizado (tolera variações
// de formato: com/sem 55, com/sem 9º dígito).
async function attributeToClinic(phone) {
  const norm = normPhone(phone);
  const candidates = await prisma.automationLog.findMany({
    where: { status: { in: ["sent", "delivered", "read"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { userId: true, patientId: true, patientName: true, phone: true },
  });
  return candidates.find((c) => normPhone(c.phone) === norm) || null;
}

// Confirma / sinaliza o próximo agendamento futuro do paciente.
async function actOnAppointment(userId, patientId, intent) {
  if (!patientId || !intent) return null;
  const appt = await prisma.appointment.findFirst({
    where: {
      userId,
      patientId,
      startsAt: { gte: new Date() },
      status: { notIn: ["CANCELED", "CONFIRMED"] },
    },
    orderBy: { startsAt: "asc" },
  });
  if (!appt) return null;

  if (intent === "confirm") {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRMED" } });
    return { appointmentId: appt.id, handled: "confirmed", appt };
  }
  if (intent === "reschedule") {
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: "RESCHEDULE_REQUESTED" } });
    return { appointmentId: appt.id, handled: "reschedule", appt };
  }
  return null;
}

// Avisa o dono da clínica no WhatsApp dele (se tiver número e cota).
// Usa o template resposta_paciente_iaso. Silencioso em qualquer falha —
// o registro no histórico (WhatsappInbound) é a fonte garantida.
async function notifyOwner(user, { patientName, replyLabel, quandoTexto }) {
  const ownerPhone = user?.phone;
  if (!ownerPhone) return false;

  const quota = await checkQuota(user.id, "whatsapp");
  if (!quota.ok) return false;

  try {
    // Vars: {{1}} paciente, {{2}} o que respondeu, {{3}} referência da consulta
    await sendWhatsAppTemplate(
      ownerPhone,
      "resposta_paciente_iaso",
      [patientName || "Um paciente", replyLabel, quandoTexto || "sua próxima consulta"],
      { language: "pt_BR" }
    );
    await consumeQuota(user.id, "whatsapp", 1, { type: "owner_notify" });
    return true;
  } catch {
    return false;
  }
}

// Ponto de entrada: 1 mensagem inbound crua da Meta (value.messages[i]).
export async function processInboundMessage(msg) {
  const phone = msg.from;
  if (!phone) return;

  const buttonPayload =
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    null;
  const text = msg.text?.body || null;
  const kind = msg.interactive ? "interactive" : msg.button ? "button" : "text";

  // Idempotência: se já registramos essa msg, ignora.
  if (msg.id) {
    const dup = await prisma.whatsappInbound.findFirst({ where: { metaMessageId: msg.id } });
    if (dup) return;
  }

  const owner = await attributeToClinic(phone);
  if (!owner) {
    // Sem envio recente pra esse número — não sabemos de qual clínica é.
    // Registra órfão? Melhor não poluir; apenas ignora silenciosamente.
    return;
  }

  const intent = classifyReply({ buttonPayload, text });
  const acted = await actOnAppointment(owner.userId, owner.patientId, intent);

  // Registra a resposta (fonte garantida p/ o histórico).
  await prisma.whatsappInbound.create({
    data: {
      userId: owner.userId,
      phone: normPhone(phone),
      patientId: owner.patientId || null,
      patientName: owner.patientName || null,
      text,
      buttonPayload,
      kind,
      metaMessageId: msg.id || null,
      appointmentId: acted?.appointmentId || null,
      handled: acted?.handled || null,
    },
  });

  // Avisa o dono no WhatsApp dele (best-effort).
  const user = await prisma.user.findUnique({
    where: { id: owner.userId },
    select: { id: true, phone: true, name: true, nickname: true, clinicName: true, gender: true },
  });
  const replyLabel = buttonPayload || text || "respondeu sua mensagem";
  let quandoTexto = "sua próxima consulta";
  if (acted?.appt) {
    const d = new Date(acted.appt.startsAt);
    quandoTexto = `a consulta de ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  await notifyOwner(user, { patientName: owner.patientName, replyLabel, quandoTexto });
}
