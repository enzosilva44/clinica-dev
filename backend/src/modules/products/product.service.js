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
      minStock: data.minStock != null ? Number(data.minStock) : null,
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
      minStock: data.minStock != null ? Number(data.minStock) : product.minStock,
      unit: data.unit,
    },
  });
}

export async function findLowStock(userId) {
  const products = await prisma.product.findMany({
    where: { userId, minStock: { not: null } },
    orderBy: { name: "asc" },
  });
  return products.filter((p) => (p.stock ?? 0) < p.minStock);
}

export async function remove(id, userId) {
  const product = await prisma.product.findFirst({ where: { id, userId } });
  if (!product) throw new Error("Produto não encontrado");

  return prisma.product.delete({ where: { id } });
}
