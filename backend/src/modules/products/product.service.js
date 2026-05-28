import { prisma } from "../../config/prisma.js";

export async function findAll(userId) {
  return prisma.product.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(data, userId) {
  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      stock: data.stock ? Number(data.stock) : 0,
      unit: data.unit,
      userId,
    },
  });
}

export async function update(id, userId, data) {
  const product = await prisma.product.findFirst({ where: { id, userId } });
  if (!product) throw new Error("Produto não encontrado");

  return prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      stock: data.stock !== undefined ? Number(data.stock) : product.stock,
      unit: data.unit,
    },
  });
}

export async function remove(id, userId) {
  const product = await prisma.product.findFirst({ where: { id, userId } });
  if (!product) throw new Error("Produto não encontrado");

  return prisma.product.delete({ where: { id } });
}
