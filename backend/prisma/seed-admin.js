import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador Iasoclin";

  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar este seed.");
  }

  const passwordHash = await bcrypt.hash(password, 8);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      role: "ADMIN",
      plan: "dev",
    },
    create: {
      name,
      email,
      password: passwordHash,
      role: "ADMIN",
      plan: "dev",
    },
  });

  console.log(`Admin pronto: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
