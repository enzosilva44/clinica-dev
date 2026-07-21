// LEITURA — exporta pacientes de uma conta como JSON (stdout).
// Uso na EC2:  node scripts/export-pacientes.js <email> > /tmp/pac.json
import { prisma } from "../src/config/prisma.js";

const email = process.argv[2];
const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error("sem usuário"); process.exit(1); }

const ps = await prisma.patient.findMany({
  where: { userId: user.id },
  select: {
    name: true, phone: true, email: true, birthDate: true,
    cpf: true, rg: true, street: true, city: true, state: true,
    zipCode: true, observations: true, isActive: true,
  },
  orderBy: { name: "asc" },
});

console.error(`Exportados: ${ps.length}`);
process.stdout.write(JSON.stringify(ps));
await prisma.$disconnect();
