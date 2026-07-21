// ─────────────────────────────────────────────────────────────────────────────
// DIAGNÓSTICO (100% LEITURA — não grava/altera nada) dos pacientes de uma conta.
// Investiga a divergência 325 (sistema antigo) vs 279 (admin Iaso).
//
// Uso na EC2:  node scripts/diag-pacientes.js dra.fernandabecari@gmail.com
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../src/config/prisma.js";

const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const onlyDigits = (s) => (s || "").replace(/\D/g, "");

async function main() {
  const email = process.argv[2];
  if (!email) { console.error("Informe o e-mail: node scripts/diag-pacientes.js <email>"); process.exit(1); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`Nenhum usuário com e-mail "${email}".`); process.exit(1); }

  console.log(`\n=== DIAGNÓSTICO DE PACIENTES ===`);
  console.log(`Conta: ${user.name} <${user.email}>  (id: ${user.id})\n`);

  const patients = await prisma.patient.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, cpf: true, phone: true, isActive: true, createdAt: true },
  });

  // 1. Total + quebra por status (isActive)
  console.log(`TOTAL de pacientes: ${patients.length}`);
  const ativos = patients.filter((p) => p.isActive !== false).length;
  console.log(`Ativos: ${ativos}  ·  Inativos: ${patients.length - ativos}`);

  // 2. Preenchimento
  const comCpf = patients.filter((p) => onlyDigits(p.cpf).length >= 11).length;
  const comTel = patients.filter((p) => onlyDigits(p.phone).length >= 8).length;
  console.log(`Com CPF válido: ${comCpf}  ·  Com telefone: ${comTel}\n`);

  // 3. Distribuição por dia de criação (revela quantas importações e quando)
  console.log("CRIADOS POR DIA:");
  const byDay = {};
  for (const p of patients) {
    const d = p.createdAt.toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  Object.entries(byDay).sort().forEach(([d, n]) => console.log(`  ${d}: ${n}`));

  // 3b. Por hora:minuto no dia de maior volume (levas de importação)
  const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topDay) {
    console.log(`\nLEVAS no dia ${topDay} (agrupado por minuto):`);
    const byMin = {};
    for (const p of patients) {
      const iso = p.createdAt.toISOString();
      if (!iso.startsWith(topDay)) continue;
      const min = iso.slice(11, 16);
      byMin[min] = (byMin[min] || 0) + 1;
    }
    Object.entries(byMin).sort().forEach(([m, n]) => console.log(`  ${topDay} ${m} UTC: ${n}`));
  }

  // 4. Duplicatas
  function dupsBy(keyFn, label, minLen = 1) {
    const groups = {};
    for (const p of patients) {
      const k = keyFn(p);
      if (!k || k.length < minLen) continue;
      (groups[k] ??= []).push(p);
    }
    const dups = Object.entries(groups).filter(([, arr]) => arr.length > 1);
    const extra = dups.reduce((s, [, arr]) => s + (arr.length - 1), 0);
    console.log(`\nDUPLICATAS por ${label}: ${dups.length} grupos, ${extra} registros repetidos (excedentes)`);
    dups.slice(0, 15).forEach(([k, arr]) => console.log(`  "${arr[0].name}" (${label}=${k}) ×${arr.length}`));
    if (dups.length > 15) console.log(`  … +${dups.length - 15} grupos`);
    return extra;
  }
  const dupNome = dupsBy((p) => norm(p.name), "nome");
  const dupCpf  = dupsBy((p) => onlyDigits(p.cpf), "CPF", 11);
  const dupTel  = dupsBy((p) => onlyDigits(p.phone), "telefone", 8);

  // 5. Resumo interpretativo
  console.log(`\n=== RESUMO ===`);
  console.log(`Total no Iaso: ${patients.length}  (admin mostra este número)`);
  console.log(`Únicos por nome (aprox): ${patients.length - dupNome}`);
  console.log(`Sistema antigo: 325 ativos → diferença p/ total Iaso: ${325 - patients.length}`);
  console.log(`\n(Consulta somente leitura — nada foi alterado.)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
