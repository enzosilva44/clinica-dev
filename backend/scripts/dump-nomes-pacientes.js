// LEITURA — exporta os nomes dos pacientes de uma conta, um por linha.
import { prisma } from "../src/config/prisma.js";
const email = process.argv[2];
const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error("sem usuário"); process.exit(1); }
const ps = await prisma.patient.findMany({ where: { userId: user.id }, select: { name: true }, orderBy: { name: "asc" } });
ps.forEach((p) => console.log(p.name));
console.error(`TOTAL: ${ps.length}`);
await prisma.$disconnect();
