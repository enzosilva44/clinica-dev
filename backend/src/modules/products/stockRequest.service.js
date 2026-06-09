import { prisma } from "../../config/prisma.js";
import * as movementService from "./movement.service.js";

export async function findAll(userId, { status } = {}) {
  const where = { userId };
  if (status && status !== "all") where.status = status;

  return prisma.stockRequest.findMany({
    where,
    include: { product: { select: { id: true, name: true, unit: true, stock: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(userId, data) {
  const product = await prisma.product.findFirst({ where: { id: data.productId, userId } });
  if (!product) throw new Error("Produto não encontrado");

  const quantity = Number(data.quantity);
  if (!quantity || quantity <= 0) throw new Error("Quantidade inválida");
  if (data.type !== "entrada" && data.type !== "saida") throw new Error("Tipo inválido");

  return prisma.stockRequest.create({
    data: {
      type: data.type,
      quantity,
      reason: data.reason || null,
      productId: data.productId,
      userId,
    },
    include: { product: { select: { id: true, name: true, unit: true, stock: true } } },
  });
}

export async function approve(requestId, userId) {
  const req = await prisma.stockRequest.findFirst({ where: { id: requestId, userId, status: "pending" } });
  if (!req) throw new Error("Solicitação não encontrada ou já resolvida");

  await movementService.create(req.productId, userId, {
    type: req.type,
    quantity: req.quantity,
    reason: req.reason,
  });

  return prisma.stockRequest.update({
    where: { id: requestId },
    data: { status: "approved", resolvedAt: new Date() },
    include: { product: { select: { id: true, name: true, unit: true, stock: true } } },
  });
}

export async function reject(requestId, userId) {
  const req = await prisma.stockRequest.findFirst({ where: { id: requestId, userId, status: "pending" } });
  if (!req) throw new Error("Solicitação não encontrada ou já resolvida");

  return prisma.stockRequest.update({
    where: { id: requestId },
    data: { status: "rejected", resolvedAt: new Date() },
    include: { product: { select: { id: true, name: true, unit: true, stock: true } } },
  });
}
