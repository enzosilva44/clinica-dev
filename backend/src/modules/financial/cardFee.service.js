import { prisma } from "../../config/prisma.js";

// Métodos de pagamento (texto livre no app) que representam cartão.
const DEBIT_HINTS = ["débito", "debito"];
const CREDIT_HINTS = ["crédito", "credito"];

export function isCardMethod(paymentMethod) {
  if (!paymentMethod) return false;
  const m = paymentMethod.toLowerCase();
  return m.includes("cart") || m.includes("card");
}

// Descobre o "type" de taxa a partir do método + parcelas.
// débito → "debito"; crédito 1x → "credito"; crédito >1x → "credito_parcelado"
function resolveType(paymentMethod, installments) {
  const m = (paymentMethod || "").toLowerCase();
  if (DEBIT_HINTS.some((h) => m.includes(h))) return "debito";
  const n = Number(installments) || 1;
  if (CREDIT_HINTS.some((h) => m.includes(h))) {
    return n > 1 ? "credito_parcelado" : "credito";
  }
  // "Cartão" genérico: parcelado se >1, senão crédito à vista
  return n > 1 ? "credito_parcelado" : "credito";
}

export async function list(userId) {
  return prisma.cardFee.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { installmentsFrom: "asc" }],
  });
}

export async function create(userId, data) {
  const isParcelado = data.type === "credito_parcelado";
  return prisma.cardFee.create({
    data: {
      userId,
      brand: data.brand || "Geral",
      type: data.type,
      installmentsFrom: isParcelado ? Number(data.installmentsFrom) || 2 : null,
      installmentsTo: isParcelado ? Number(data.installmentsTo) || null : null,
      percent: Number(data.percent) || 0,
    },
  });
}

export async function update(userId, id, data) {
  const fee = await prisma.cardFee.findFirst({ where: { id, userId } });
  if (!fee) throw new Error("Taxa não encontrada");
  const type = data.type ?? fee.type;
  const isParcelado = type === "credito_parcelado";
  return prisma.cardFee.update({
    where: { id },
    data: {
      brand: data.brand ?? fee.brand,
      type,
      installmentsFrom: isParcelado ? Number(data.installmentsFrom) || fee.installmentsFrom || 2 : null,
      installmentsTo: isParcelado ? (data.installmentsTo != null ? Number(data.installmentsTo) : fee.installmentsTo) : null,
      percent: data.percent != null ? Number(data.percent) : fee.percent,
    },
  });
}

export async function remove(userId, id) {
  const fee = await prisma.cardFee.findFirst({ where: { id, userId } });
  if (!fee) throw new Error("Taxa não encontrada");
  await prisma.cardFee.delete({ where: { id } });
  return { ok: true };
}

// Escolhe a taxa aplicável e devolve o cálculo. Retorna null se não houver
// taxa cadastrada / o pagamento não for no cartão.
export async function computeFee(userId, { paymentMethod, cardBrand, installments, amount }) {
  if (!isCardMethod(paymentMethod)) return null;
  const type = resolveType(paymentMethod, installments);
  const n = Number(installments) || 1;

  const fees = await prisma.cardFee.findMany({ where: { userId, type } });
  if (fees.length === 0) return null;

  const inRange = (f) => {
    if (type !== "credito_parcelado") return true;
    const from = f.installmentsFrom ?? 2;
    const to = f.installmentsTo ?? Infinity;
    return n >= from && n <= to;
  };

  // Candidatas: casam a faixa de parcelas. Bandeira exata tem prioridade sobre "Geral".
  const candidates = fees.filter(inRange);
  const match =
    (cardBrand && candidates.find((f) => f.brand === cardBrand)) ||
    candidates.find((f) => f.brand === "Geral") ||
    candidates[0];
  if (!match) return null;

  const gross = Number(amount) || 0;
  const feeAmount = Math.round(gross * (match.percent / 100) * 100) / 100;
  const netAmount = Math.round((gross - feeAmount) * 100) / 100;
  return {
    cardBrand: cardBrand || match.brand,
    feePercent: match.percent,
    feeAmount,
    netAmount,
  };
}
