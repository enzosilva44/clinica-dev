import crypto from "crypto";
import { prisma } from "../../config/prisma.js";
import { processInboundMessage } from "../automations/inbound.service.js";
import { enqueueWebhookEvent } from "../conversations/webhook/webhookEvent.service.js";
import {
  isSupportNumber,
  recordInboundSupportMessage,
  recordOutboundSupportMessage,
  updateOutboundStatus as updateSupportOutboundStatus,
} from "../support/support.service.js";

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

// GET — verificação inicial do webhook (Meta manda hub.challenge).
export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// Valida a assinatura HMAC-SHA256 que a Meta envia no header x-hub-signature-256.
// Depende de req.rawBody, capturado no app.js via a opção `verify` do express.json.
function isValidSignature(req) {
  if (!APP_SECRET) return false;
  const signature = req.get("x-hub-signature-256");
  if (!signature || !req.rawBody) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Eventos da central de suporte: grava o ticket e, se a triagem decidiu uma
// resposta automática, envia. O envio respeita o kill switch do provider — com
// WHATSAPP_SEND_ENABLED != true nada sai, mas o ticket é registrado igual.
// Falha ao responder nunca perde a mensagem do cliente, que já está gravada.
async function handleSupportChange(value) {
  const waName = value.contacts?.[0]?.profile?.name ?? null;

  for (const msg of value.messages || []) {
    const result = await recordInboundSupportMessage(msg, { waName });
    if (!result?.reply) continue;

    try {
      const { sendWhatsAppMessage } = await import("../whatsapp/whatsapp.provider.js");
      const sent = await sendWhatsAppMessage(msg.from, result.reply.text, {
        phoneNumberId: process.env.SUPPORT_PHONE_NUMBER_ID,
        accessToken: process.env.SUPPORT_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN,
      });
      await recordOutboundSupportMessage({
        ticketId: result.ticketId,
        text: result.reply.text,
        authorKind: "automation",
        metaMessageId: sent?.messages?.[0]?.id ?? null,
      });
    } catch (e) {
      await recordOutboundSupportMessage({
        ticketId: result.ticketId,
        text: result.reply.text,
        authorKind: "automation",
      }).catch(() => {});
      console.error("[support] falha ao enviar resposta automática:", e.message);
    }
  }

  for (const st of value.statuses || []) {
    if (st.id && st.status) await updateSupportOutboundStatus(st.id, st.status).catch(() => {});
  }
}

// POST — eventos: status de entrega, mensagens recebidas, status de template.
export async function receiveWebhook(req, res) {
  if (!isValidSignature(req)) {
    return res.sendStatus(401);
  }
  // Responde 200 imediatamente; processa depois (a Meta reenvia se demorar).
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Iaso Conversas: enfileira o change cru na fila durável (idempotente).
        // Não bloqueia nem substitui o fluxo de automações abaixo — a Fase 2
        // do módulo passa a consumir esta fila. Best-effort, nunca quebra o webhook.
        await enqueueWebhookEvent(change).catch(() => {});

        // IASO SUPORTE: eventos do número da central não são conversa de
        // paciente — viram ticket e saem daqui. Sem este desvio a mensagem cai
        // no fluxo de automações abaixo e é descartada por não casar com
        // nenhum paciente. Com SUPPORT_PHONE_NUMBER_ID ausente o teste é
        // sempre falso e nada muda para as clínicas.
        if (isSupportNumber(value.metadata?.phone_number_id)) {
          await handleSupportChange(value).catch((e) =>
            console.error("[whatsapp-webhook] suporte:", e.message)
          );
          continue;
        }

        // Status de entrega das mensagens que enviamos (sent/delivered/read/failed).
        for (const status of value.statuses || []) {
          await prisma.automationLog
            .updateMany({
              where: { metaMessageId: status.id },
              data: {
                status: status.status, // sent | delivered | read | failed
                ...(status.status === "failed"
                  ? { error: status.errors?.[0]?.title || "failed" }
                  : {}),
              },
            })
            .catch(() => {});
        }

        // Mensagens recebidas dos pacientes: atribui à clínica, age na agenda
        // (confirmar/remarcar), registra no histórico e avisa o dono.
        for (const msg of value.messages || []) {
          await processInboundMessage(msg).catch((e) =>
            console.error("[whatsapp-webhook] inbound:", e.message)
          );
        }
      }
    }
  } catch (err) {
    // Já respondemos 200; apenas logamos falha de processamento.
    console.error("[whatsapp-webhook] erro ao processar:", err.message);
  }
}
