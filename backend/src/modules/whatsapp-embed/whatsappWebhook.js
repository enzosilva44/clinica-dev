import crypto from "crypto";
import { prisma } from "../../config/prisma.js";

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

        // Mensagens recebidas dos pacientes (abre janela de 24h de conversa grátis).
        // Por ora só logamos; tratamento de resposta é evolução futura.
        for (const _msg of value.messages || []) {
          // TODO: registrar inbound / abrir janela de conversa
        }
      }
    }
  } catch (err) {
    // Já respondemos 200; apenas logamos falha de processamento.
    console.error("[whatsapp-webhook] erro ao processar:", err.message);
  }
}
