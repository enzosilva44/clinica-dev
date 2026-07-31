// Enfileiramento durável dos changes recebidos no webhook da Meta.
// Cada `change` de entry.changes[] vira uma linha em WebhookEvent, com hash
// estável para idempotência (a Meta reenvia o mesmo evento se demorarmos a
// responder). O webhook chama enqueue e responde 200 na hora; o worker
// (webhookWorker.js) drena depois.
import crypto from "crypto";
import { prisma } from "../../../config/prisma.js";

// Hash estável do change. Prioriza IDs da Meta (mensagem / status) para que o
// MESMO evento produza SEMPRE o mesmo hash, mesmo que a ordem das chaves varie.
// Fallback: hash do JSON inteiro (eventos sem id explícito).
function payloadHash(change) {
  const value = change?.value || {};
  const ids = [];
  for (const m of value.messages || []) if (m.id) ids.push(`msg:${m.id}`);
  for (const s of value.statuses || []) {
    // status muda de estado (sent→delivered→read) para o mesmo id: inclui o
    // estado no hash para não descartar transições legítimas como duplicata.
    if (s.id) ids.push(`st:${s.id}:${s.status}`);
  }
  const basis = ids.length ? ids.sort().join("|") : JSON.stringify(change);
  return crypto.createHash("sha256").update(basis).digest("hex");
}

// Grava um change como evento pendente. Idempotente: se o hash já existe,
// não cria de novo (retorna { duplicated: true }). Nunca lança — o webhook
// já respondeu 200 e não pode quebrar por causa da fila.
export async function enqueueWebhookEvent(change, source = "whatsapp") {
  try {
    const hash = payloadHash(change);
    await prisma.webhookEvent.create({
      data: { source, payloadHash: hash, payload: change },
    });
    return { enqueued: true };
  } catch (err) {
    // P2002 = violação de unique (payloadHash) → evento repetido, esperado.
    if (err?.code === "P2002") return { duplicated: true };
    console.error("[webhook-event] falha ao enfileirar:", err.message);
    return { error: true };
  }
}
