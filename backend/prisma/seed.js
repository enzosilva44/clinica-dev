import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user =
    await prisma.user.findFirst();

  if (!user) {
    throw new Error(
      "Nenhum usuário encontrado"
    );
  }

  for (let i = 1; i <= 30; i++) {
    const patient =
      await prisma.patient.create({
        data: {
          name: `Paciente ${i}`,

          email: `paciente${i}@email.com`,

          phone: `(16) 99999-00${i}`,

          cpf: `000.000.000-${String(
            i
          ).padStart(2, "0")}`,

          city: "Franca",

          state: "SP",

          country: "Brasil",

          user: {
            connect: {
              id: user.id,
            },
          },
        },
      });

    await prisma.appointment.create({
      data: {
        title:
          "Consulta estética",

        description:
          "Avaliação inicial",

        startsAt: new Date(),

        endsAt: new Date(),

        patient: {
          connect: {
            id: patient.id,
          },
        },

        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });
  }
}

main()
  .then(() => {
    console.log(
      "Seed executada"
    );
  })
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });