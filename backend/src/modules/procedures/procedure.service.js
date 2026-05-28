import { prisma } from "../../config/prisma.js";

export async function findAll(
  userId
) {
  return prisma.procedure.findMany({
    where: {
      userId,
    },

    include: {
      products: {
        include: {
          product: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function create(
  data,
  userId
) {
  return prisma.procedure.create({
    data: {
      name: data.name,

      description:
        data.description,

      category:
        data.category,

      duration:
        data.duration,

      price: data.price,

      hasMultipleSessions:
        data.hasMultipleSessions,

      requiresReturn:
        data.requiresReturn,

      returnDays:
        data.returnDays,

      userId,

      products: {
        create:
          data.products
            ?.filter(
              (item) =>
                item.productId ||
                item.customName
            )
            .map((item) => ({
              ...(item.productId && {
                product: {
                  connect: {
                    id: item.productId,
                  },
                },
              }),

              customName:
                item.customName ||
                null,

              quantity:
                Number(
                  item.quantity
                ) || 1,

              perSession:
                item.perSession,
            })) || [],
      },
    },

    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function remove(
  id
) {
  return prisma.procedure.delete({
    where: {
      id,
    },
  });
}

export async function update(
  id,
  data
) {
  await prisma.procedureProduct.deleteMany({
    where: {
      procedureId: id,
    },
  });

  return prisma.procedure.update({
    where: {
      id,
    },

    data: {
      name: data.name,

      description:
        data.description,

      category:
        data.category,

      duration:
        data.duration,

      price: data.price,

      hasMultipleSessions:
        data.hasMultipleSessions,

      requiresReturn:
        data.requiresReturn,

      returnDays:
        data.returnDays,

      products: {
        create:
          data.products
            ?.filter(
              (item) =>
                item.productId ||
                item.customName
            )
            .map((item) => ({
              ...(item.productId && {
                product: {
                  connect: {
                    id: item.productId,
                  },
                },
              }),

              customName:
                item.customName ||
                null,

              quantity:
                Number(
                  item.quantity
                ) || 1,

              perSession:
                item.perSession,
            })) || [],
      },
    },

    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });
}