import { prisma } from "../../config/prisma.js";

// Valor do protocolo: soma dos procedimentos de TODAS as sessões
// (unitPrice × quantity) por padrão; se useFixedPrice, usa fixedPrice.
// Expõe proceduresTotal + total + sessionCount (nº de cards de sessão).
function withComputedTotal(protocol) {
  const sessions = protocol.sessions || [];
  const proceduresTotal = sessions.reduce(
    (sTotal, s) =>
      sTotal +
      (s.procedures || []).reduce(
        (acc, p) => acc + (Number(p.unitPrice) || 0) * (Number(p.quantity) || 1),
        0,
      ),
    0,
  );
  const total = protocol.useFixedPrice
    ? Number(protocol.fixedPrice) || 0
    : proceduresTotal;
  return { ...protocol, proceduresTotal, total, sessionCount: sessions.length };
}

const includeTree = {
  sessions: {
    orderBy: { position: "asc" },
    include: {
      procedures: {
        orderBy: { position: "asc" },
        include: { products: { orderBy: { createdAt: "asc" } } },
      },
    },
  },
};

export async function findAll(userId) {
  const protocols = await prisma.protocol.findMany({
    where: { userId, isActive: true },
    include: includeTree,
    orderBy: { name: "asc" },
  });
  return protocols.map(withComputedTotal);
}

export async function findById(id, userId) {
  const protocol = await prisma.protocol.findFirst({
    where: { id, userId },
    include: includeTree,
  });
  if (!protocol) throw new Error("Protocolo não encontrado");
  return withComputedTotal(protocol);
}

// Monta o nested create das sessões → procedimentos → produtos.
function buildSessionsCreate(sessions = []) {
  return sessions.map((session, sIdx) => ({
    position: sIdx,
    label: session.label?.trim() || null,
    procedures: {
      create: (session.procedures || [])
        .filter((p) => p && p.procedureName)
        .map((p, pIdx) => ({
          procedureId: p.procedureId || null,
          procedureName: p.procedureName,
          unitPrice: Math.max(Number(p.unitPrice) || 0, 0),
          quantity: Math.max(Number(p.quantity) || 1, 1),
          position: pIdx,
          products: {
            create: (p.products || [])
              .filter((prod) => prod && (prod.productId || prod.customName))
              .map((prod) => ({
                productId: prod.productId || null,
                customName: prod.customName || null,
                quantity: Math.max(Number(prod.quantity) || 0, 0),
              })),
          },
        })),
    },
  }));
}

// Garante ao menos 1 sessão com ao menos 1 procedimento.
function assertSessions(sessions) {
  const clean = (sessions || []).filter(
    (s) => (s.procedures || []).some((p) => p && p.procedureName?.trim()),
  );
  if (clean.length === 0) {
    throw new Error("Adicione ao menos uma sessão com um procedimento");
  }
  return clean;
}

export async function create(data, userId) {
  const sessions = assertSessions(data.sessions);
  const useFixedPrice = Boolean(data.useFixedPrice);
  const protocol = await prisma.protocol.create({
    data: {
      name: data.name,
      description: data.description || null,
      useFixedPrice,
      fixedPrice: useFixedPrice ? Math.max(Number(data.fixedPrice) || 0, 0) : null,
      userId,
      sessions: { create: buildSessionsCreate(sessions) },
    },
    include: includeTree,
  });
  return withComputedTotal(protocol);
}

export async function update(id, data, userId) {
  const existing = await prisma.protocol.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Protocolo não encontrado");

  const sessions = assertSessions(data.sessions);
  const useFixedPrice = Boolean(data.useFixedPrice);
  // Substitui a árvore inteira (sessões/procedimentos/produtos). onDelete:
  // Cascade limpa os filhos ao apagar as ProtocolSession.
  const protocol = await prisma.$transaction(async (tx) => {
    await tx.protocolSession.deleteMany({ where: { protocolId: id } });
    return tx.protocol.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        useFixedPrice,
        fixedPrice: useFixedPrice ? Math.max(Number(data.fixedPrice) || 0, 0) : null,
        sessions: { create: buildSessionsCreate(sessions) },
      },
      include: includeTree,
    });
  });
  return withComputedTotal(protocol);
}

// Soft delete: mantém histórico (orçamentos já criados a partir do protocolo
// não dependem dele — são snapshots), só some da lista/seletor.
export async function remove(id, userId) {
  const existing = await prisma.protocol.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Protocolo não encontrado");
  await prisma.protocol.update({ where: { id }, data: { isActive: false } });
  return { ok: true };
}
