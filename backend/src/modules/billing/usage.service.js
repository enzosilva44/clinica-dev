import { prisma } from "../../config/prisma.js";
import { asaas } from "./billing.service.js";
import { getTopupPack } from "../../config/quotas.js";
import { addTopup } from "./quota.service.js";

// Chave Asaas da IASO (conta RAIZ) — top-up é cobrança CLÍNICA→IASO, igual à
// mensalidade (não usa a subconta da clínica). Ver contract.service.iasoKey().
function iasoKey() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY (conta Iaso) não configurada.");
  return key;
}

// Prefixo do externalReference que o webhook reconhece p/ creditar o top-up.
// Formato: topup:<userId>:<resource>:<amount>
const TOPUP_REF_PREFIX = "topup";

export function buildTopupRef(userId, resource, amount) {
  return `${TOPUP_REF_PREFIX}:${userId}:${resource}:${amount}`;
}

export function parseTopupRef(ref) {
  if (!ref || !ref.startsWith(`${TOPUP_REF_PREFIX}:`)) return null;
  const [, userId, resource, amount] = ref.split(":");
  const amt = Number(amount);
  if (!userId || !resource || !Number.isFinite(amt)) return null;
  return { userId, resource, amount: amt };
}

// Cria uma cobrança PIX avulsa (top-up) na conta RAIZ da Iaso. O crédito das
// unidades acontece só no webhook, quando o pagamento é confirmado.
export async function createTopupCharge(userId, resource, packId) {
  const pack = getTopupPack(resource, packId);
  if (!pack) throw new Error("Pacote de top-up inválido.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, clinicName: true, email: true, cpf: true, cnpj: true },
  });
  if (!user) throw new Error("Usuário não encontrado.");

  const key = iasoKey();

  const customer = await asaas("POST", "/customers", {
    name: user.clinicName || user.name,
    email: user.email,
    cpfCnpj: (user.cpf || user.cnpj || "").replace(/\D/g, "") || undefined,
  }, key);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const payment = await asaas("POST", "/payments", {
    customer: customer.id,
    billingType: "PIX",
    value: pack.price,
    dueDate: dueDate.toISOString().slice(0, 10),
    description: `Iasoclin — top-up ${pack.label}`,
    externalReference: buildTopupRef(userId, pack.resource, pack.amount),
  }, key);

  // Traz o QR Code PIX para o front exibir na hora.
  let pix = null;
  try {
    pix = await asaas("GET", `/payments/${payment.id}/pixQrCode`, null, key);
  } catch { /* QR pode não estar pronto imediatamente; front pode repuxar */ }

  return {
    chargeId: payment.id,
    value: pack.price,
    pack: pack.label,
    invoiceUrl: payment.invoiceUrl,
    pixQrCode: pix?.encodedImage ?? null,
    pixPayload: pix?.payload ?? null,
  };
}

// Chamado pelo webhook quando um pagamento com externalReference de top-up é
// confirmado — credita as unidades no ciclo atual do tenant.
export async function creditTopupFromWebhook(ref) {
  const parsed = parseTopupRef(ref);
  if (!parsed) return false;
  await addTopup(parsed.userId, parsed.resource, parsed.amount);
  console.log(`[topup] creditado ${parsed.amount} de ${parsed.resource} p/ user ${parsed.userId}`);
  return true;
}
