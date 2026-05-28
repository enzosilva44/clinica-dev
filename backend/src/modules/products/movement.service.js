import { prisma } from "../../config/prisma.js";

export async function findByProduct(productId, userId) {
  const product = await prisma.product.findFirst({ where: { id: productId, userId } });
  if (!product) throw new Error("Produto não encontrado");

  return prisma.productMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
}

export async function create(productId, userId, data) {
  const product = await prisma.product.findFirst({ where: { id: productId, userId } });
  if (!product) throw new Error("Produto não encontrado");

  const quantity = Number(data.quantity);
  if (!quantity || quantity <= 0) throw new Error("Quantidade inválida");

  const type = data.type; // "entrada" | "saida"
  if (type !== "entrada" && type !== "saida") throw new Error("Tipo inválido");

  const newStock =
    type === "entrada"
      ? (product.stock ?? 0) + quantity
      : (product.stock ?? 0) - quantity;

  if (newStock < 0) throw new Error("Estoque insuficiente para essa saída");

  const [movement] = await prisma.$transaction([
    prisma.productMovement.create({
      data: {
        type,
        quantity,
        reason: data.reason || null,
        productId,
        userId,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    }),
  ]);

  return movement;
}
