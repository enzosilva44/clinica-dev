// Importa pacientes de um JSON para uma conta. Dedup por nome (idempotente).
// Uso:  node scripts/import-pacientes-json.js <email-destino> <arquivo.json> [--commit]
import { prisma } from "../src/config/prisma.js";
import { readFileSync } from "node:fs";

const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function main() {
  const email = process.argv[2];
  const file = process.argv[3];
  const commit = process.argv.includes("--commit");
  if (!email || !file) { console.error("uso: <email> <arquivo.json> [--commit]"); process.exit(1); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`sem usuário "${email}"`); process.exit(1); }

  const rows = JSON.parse(readFileSync(file, "utf8"));
  const existing = await prisma.patient.findMany({ where: { userId: user.id }, select: { name: true } });
  const have = new Set(existing.map((p) => norm(p.name)));

  console.log(`\nDestino: ${user.email} (${existing.length} pacientes já lá)`);
  console.log(`Arquivo: ${rows.length} pacientes`);
  console.log(commit ? "🟢 COMMIT\n" : "🟡 DRY-RUN (use --commit p/ gravar)\n");

  let novos = 0, pulados = 0;
  for (const p of rows) {
    if (!p.name?.trim()) { pulados++; continue; }
    if (have.has(norm(p.name))) { pulados++; continue; }
    have.add(norm(p.name));
    novos++;
    if (commit) {
      await prisma.patient.create({
        data: {
          name: p.name.trim(),
          phone: p.phone || "", // schema exige phone (não-nullable); sem telefone → vazio
          email: p.email || null,
          birthDate: p.birthDate ? new Date(p.birthDate) : null,
          cpf: p.cpf || null,
          rg: p.rg || null,
          street: p.street || null,
          city: p.city || null,
          state: p.state || null,
          zipCode: p.zipCode || null,
          observations: p.observations || null,
          isActive: p.isActive !== false,
          user: { connect: { id: user.id } },
        },
      });
    }
  }
  console.log(`Resumo: ${novos} a criar · ${pulados} pulados (já existem/sem nome)`);
  console.log(commit ? "✅ Gravado.\n" : "ℹ️  --commit p/ gravar.\n");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
