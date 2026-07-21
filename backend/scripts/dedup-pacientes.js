// Remove pacientes DUPLICADOS por nome numa conta, mantendo o mais antigo de
// cada nome. Só remove duplicatas SEM vínculos (appointments/evolutions/etc).
// Uso:  node scripts/dedup-pacientes.js <email> [--commit]
import { prisma } from "../src/config/prisma.js";

const email = process.argv[2];
const commit = process.argv.includes("--commit");
const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error("sem usuário"); process.exit(1); }

const ps = await prisma.patient.findMany({
  where: { userId: user.id },
  select: {
    id: true, name: true, createdAt: true,
    _count: { select: { appointments: true, evolutions: true, budgets: true, clubMemberships: true } },
  },
  orderBy: { createdAt: "asc" },
});

const byName = new Map();
for (const p of ps) (byName.get(p.name) ?? byName.set(p.name, []).get(p.name)).push(p);

const toDelete = [];
let comVinculo = 0;
for (const [, arr] of byName) {
  if (arr.length < 2) continue;
  // mantém o 1º (mais antigo); remove os demais SE não tiverem vínculos
  for (const p of arr.slice(1)) {
    const links = p._count.appointments + p._count.evolutions + p._count.budgets + p._count.clubMemberships;
    if (links > 0) { comVinculo++; continue; }
    toDelete.push(p.id);
  }
}

console.log(`\nDestino: ${user.email} — ${ps.length} pacientes, ${[...byName.values()].filter(a=>a.length>1).length} nomes duplicados`);
console.log(`A remover (excedentes sem vínculo): ${toDelete.length}`);
if (comVinculo) console.log(`⚠️ ${comVinculo} duplicatas COM vínculo — não removidas (revisar manual)`);
console.log(commit ? "🟢 COMMIT\n" : "🟡 DRY-RUN (use --commit)\n");

if (commit && toDelete.length) {
  const r = await prisma.patient.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`✅ Removidos: ${r.count}`);
}
await prisma.$disconnect();
