import { prisma } from "../../config/prisma.js";
import {
  getResourceLimit,
  isResourceActive,
  QUOTA_RESOURCES,
} from "../../config/quotas.js";

// Lançado quando uma ação excede a cota do recurso. Controllers traduzem em HTTP 402.
export class QuotaExceededError extends Error {
  constructor(resource, { used, limit } = {}) {
    super(`Cota de "${resource}" esgotada.`);
    this.name = "QuotaExceededError";
    this.resource = resource;
    this.used = used;
    this.limit = limit;
  }
}

// 1º dia do mês corrente em UTC — âncora do ciclo. Reset é lazy: a linha do próximo
// mês nasce zerada na 1ª ação do novo período (sem cron).
export function currentPeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function resolvePlan(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return user?.plan ?? "essencial";
}

// Upsert idempotente da linha do ciclo atual. limit é copiado do plano no nascimento
// (mudança de plano no meio do mês não reescreve retroativo). limit null = ilimitado.
export async function getCounter(userId, resource) {
  const periodStart = currentPeriodStart();
  const existing = await prisma.usageCounter.findUnique({
    where: { userId_resource_periodStart: { userId, resource, periodStart } },
  });
  if (existing) return existing;

  const plan = await resolvePlan(userId);
  const limit = getResourceLimit(plan, resource); // null = ilimitado

  // create com fallback a findUnique p/ corrida (unique constraint garante 1 linha).
  try {
    return await prisma.usageCounter.create({
      data: { userId, resource, periodStart, limit },
    });
  } catch {
    return prisma.usageCounter.findUnique({
      where: { userId_resource_periodStart: { userId, resource, periodStart } },
    });
  }
}

// Pré-checagem sem debitar (medidor). remaining null = ilimitado.
export async function checkQuota(userId, resource, cost = 1) {
  if (!isResourceActive(resource)) {
    return { ok: true, used: 0, limit: null, topup: 0, remaining: null };
  }
  const counter = await getCounter(userId, resource);
  if (counter.limit == null) {
    return { ok: true, used: counter.used, limit: null, topup: counter.topup, remaining: null };
  }
  const cap = counter.limit + counter.topup;
  const remaining = cap - counter.used;
  return {
    ok: counter.used + cost <= cap,
    used: counter.used,
    limit: counter.limit,
    topup: counter.topup,
    remaining,
  };
}

// Debita cost unidades do recurso no ciclo atual e registra o UsageEvent.
// Recurso inativo ⇒ no-op. Recurso ilimitado ⇒ registra evento, nunca bloqueia.
// Estouro ⇒ lança QuotaExceededError (nada é debitado).
export async function consumeQuota(userId, resource, cost = 1, meta = null) {
  if (!isResourceActive(resource)) return { ok: true, skipped: true };

  const periodStart = currentPeriodStart();
  await getCounter(userId, resource); // garante que a linha existe

  return prisma.$transaction(async (tx) => {
    const counter = await tx.usageCounter.findUnique({
      where: { userId_resource_periodStart: { userId, resource, periodStart } },
    });

    const unlimited = counter.limit == null;
    if (!unlimited) {
      const cap = counter.limit + counter.topup;
      if (counter.used + cost > cap) {
        throw new QuotaExceededError(resource, { used: counter.used, limit: counter.limit });
      }
    }

    const updated = await tx.usageCounter.update({
      where: { userId_resource_periodStart: { userId, resource, periodStart } },
      data: { used: { increment: cost } },
    });
    await tx.usageEvent.create({ data: { userId, resource, cost, meta } });

    return { ok: true, used: updated.used, limit: updated.limit, topup: updated.topup };
  });
}

// Snapshot do consumo do ciclo atual para o medidor (front do app + painel admin).
// Retorna todos os recursos declarados no registry (ativos e pré-declarados).
export async function getUsage(userId) {
  const resources = [];
  for (const [key, meta] of Object.entries(QUOTA_RESOURCES)) {
    const counter = await getCounter(userId, key);
    const limit = counter.limit; // null = ilimitado
    const cap = limit == null ? null : limit + counter.topup;
    const remaining = cap == null ? null : Math.max(0, cap - counter.used);
    const percent = cap && cap > 0 ? Math.min(100, Math.round((counter.used / cap) * 100)) : null;
    resources.push({
      resource: key,
      label: meta.label,
      unit: meta.unit,
      active: meta.active,
      used: counter.used,
      limit,
      topup: counter.topup,
      remaining,
      percent,
    });
  }
  return { periodStart: currentPeriodStart(), resources };
}

// Credita unidades avulsas (top-up) no ciclo atual — usado após pagamento confirmado.
export async function addTopup(userId, resource, amount) {
  await getCounter(userId, resource);
  const periodStart = currentPeriodStart();
  return prisma.usageCounter.update({
    where: { userId_resource_periodStart: { userId, resource, periodStart } },
    data: { topup: { increment: amount } },
  });
}
