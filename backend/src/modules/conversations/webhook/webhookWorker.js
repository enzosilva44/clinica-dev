// Worker in-process que drena a fila WebhookEvent.
// Fase 1: pega os `pending` prontos, marca `processing`, chama o processador
// (no-op documentado nesta fase) e marca `processed`. Em erro, incrementa
// attempts e volta a `pending` (backoff) até MAX_ATTEMPTS, então `failed`
// (reprocessável manualmente depois). Sem Redis/BullMQ: o Postgres é a fila.
//
// Escala vira problema? Trocar este arquivo por SQS+DLQ sem tocar no resto —
// enqueue e processamento já estão desacoplados.
import { prisma } from "../../../config/prisma.js";
import { recordInboundMessage, updateOutboundStatus } from "../conversation.service.js";
import {
  isSupportNumber,
  recordInboundSupportMessage,
  recordOutboundSupportMessage,
  updateOutboundStatus as updateSupportStatus,
} from "../../support/support.service.js";

const BATCH = 20; // eventos por ciclo
const MAX_ATTEMPTS = 5; // depois disso vira `failed` e sai da rotação
// Backoff exponencial (minutos) por nº de tentativas já feitas.
const BACKOFF_MIN = [0, 1, 5, 15, 60];

function nextEligibleAt(attempts) {
  const min = BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)];
  return new Date(Date.now() - min * 60_000); // elegível se receivedAt <= agora - backoff
}

// Processa UM change: materializa a conversa (Fase 2).
// - value.messages[] → mensagens inbound (viram Contact/Conversation/Message)
// - value.statuses[] → atualização de entrega das mensagens que enviamos
// Cada item é idempotente no service (por metaMessageId), então reprocessar o
// mesmo evento em retry não duplica nada.
//
// ROTEAMENTO POR NÚMERO: a Meta manda o phone_number_id de destino em
// value.metadata. O número da central de suporte (SUPPORT_PHONE_NUMBER_ID) vai
// para o Iaso Suporte; qualquer outro segue no inbox por clínica. Sem essa
// separação, conversa de suporte cairia na caixa de uma clínica.
async function processEvent(event) {
  const value = event.payload?.value;
  if (!value) throw new Error("payload sem value");

  if (isSupportNumber(value.metadata?.phone_number_id)) {
    return processSupportEvent(value);
  }

  for (const msg of value.messages || []) {
    await recordInboundMessage(msg);
  }
  for (const st of value.statuses || []) {
    if (st.id && st.status) await updateOutboundStatus(st.id, st.status);
  }
}

// Eventos da central de suporte: grava o ticket e, se a triagem decidiu uma
// resposta automática, envia. O envio respeita o kill switch do provider —
// com WHATSAPP_SEND_ENABLED != true nada sai, mas o ticket é registrado igual.
async function processSupportEvent(value) {
  const waName = value.contacts?.[0]?.profile?.name ?? null;

  for (const msg of value.messages || []) {
    const result = await recordInboundSupportMessage(msg, { waName });
    if (!result?.reply) continue;

    try {
      const { sendWhatsAppMessage } = await import("../../whatsapp/whatsapp.provider.js");
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
      // Falha ao responder não pode perder a mensagem do cliente, que já está
      // gravada. Registra o erro na timeline e segue.
      await recordOutboundSupportMessage({
        ticketId: result.ticketId,
        text: result.reply.text,
        authorKind: "automation",
      }).catch(() => {});
      console.error("[support] falha ao enviar resposta automática:", e.message);
    }
  }

  for (const st of value.statuses || []) {
    if (st.id && st.status) await updateSupportStatus(st.id, st.status);
  }
}

// Um ciclo de drenagem. Retorna quantos processou (para logs/testes).
export async function drainOnce() {
  // Candidatos: pending com backoff vencido. Ordena por mais antigo primeiro.
  const candidates = await prisma.webhookEvent.findMany({
    where: { status: "pending" },
    orderBy: { receivedAt: "asc" },
    take: BATCH,
  });

  let handled = 0;
  for (const ev of candidates) {
    // Respeita o backoff: só processa se já passou a janela para as tentativas feitas.
    if (ev.receivedAt > nextEligibleAt(ev.attempts)) continue;

    // Claim atômico: só assume se ainda estiver pending (evita corrida se um dia
    // rodarem 2 workers). count=0 → outro worker pegou; pula.
    const claim = await prisma.webhookEvent.updateMany({
      where: { id: ev.id, status: "pending" },
      data: { status: "processing" },
    });
    if (claim.count === 0) continue;

    try {
      await processEvent(ev);
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: { status: "processed", processedAt: new Date(), lastError: null },
      });
      handled++;
    } catch (err) {
      const attempts = ev.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: {
          status: failed ? "failed" : "pending",
          attempts,
          lastError: String(err.message).slice(0, 500),
        },
      });
      if (failed) {
        console.error(`[webhook-worker] evento ${ev.id} FALHOU após ${attempts} tentativas: ${err.message}`);
      }
    }
  }
  return handled;
}

let timer = null;

// Inicia o loop de drenagem. Intervalo curto porque o volume interno é baixo;
// não roda ciclos sobrepostos (guarda `running`).
export function startWebhookWorker({ intervalMs = 5_000 } = {}) {
  if (timer) return;
  let running = false;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await drainOnce();
    } catch (e) {
      console.error("[webhook-worker] ciclo falhou:", e.message);
    } finally {
      running = false;
    }
  }, intervalMs);
  console.log("[webhook-worker] iniciado (fila WebhookEvent).");
}
