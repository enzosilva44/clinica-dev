// ─────────────────────────────────────────────────────────────────────────────
// Migração pontual de procedimentos de uma clínica (sistema antigo → Iaso).
// Roda DEPOIS de migrate-products.js (procedimentos ligam aos produtos existentes).
//
// Uso:
//   node scripts/migrate-procedures.js <email>            # DRY-RUN (não grava)
//   node scripts/migrate-procedures.js <email> --commit   # grava
//
// - Casa cada produto do procedimento pelo NOME com os produtos já cadastrados
//   do usuário → usa productId real (permite baixa de estoque). Sem match →
//   grava como customName (texto livre) e avisa no relatório.
// - Produto repetido no mesmo procedimento tem as quantidades SOMADAS.
// - Upsert por nome de procedimento (rodar 2x não duplica).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../src/config/prisma.js";

// qty = quantidade por sessão. sessions/returnDays presentes = "Requer Sessões".
const PROCEDURES = [
  { name: "Avaliação", duration: 40, price: 0, products: [] },
  { name: "Fio filler", duration: 30, price: 350, products: [
    ["Agulha 13x0.30mm", 1], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1],
    ["Babador", 1], ["Agulha 25x 0,80 21g (verde)", 1], ["Fio filler", 1],
  ]},
  { name: "Gordura Localizada", duration: 40, price: 120, sessions: 1, returnDays: 7, products: [
    ["Agulha 13x0.30mm", 3], ["Agulha 40x 1,20mm (rosa)", 1], ["Babador", 1],
    ["Luva Descartável Látex com pó Unigloves", 2], ["Mescla Lipossomada c/ Ácido Desoxicólico", 1], ["Seringa 10ml", 1],
  ]},
  { name: "HIPRO COLO", duration: 30, price: 900, products: [] },
  { name: "HIPRO FULL FACE", duration: 60, price: 1850, products: [
    ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 1],
  ]},
  { name: "HIPRO OLHOS", duration: 60, price: 600, products: [] },
  { name: "HIPRO PAPADA", duration: 30, price: 850, products: [] },
  { name: "HIPRO PESCOÇO", duration: 60, price: 900, products: [] },
  { name: "HIPRO RETORNO", duration: 30, price: 0, products: [] },
  { name: "HIPRO TERÇO MÉDIO", duration: 30, price: 1000, products: [] },
  { name: "Intradermoterapia Capilar", duration: 60, price: 180, sessions: 1, returnDays: 15, products: [
    ["Agulha 13x0.30mm", 5], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Mescla Alopécia Androgenética", 1], ["Agulha 40x 1,20mm (rosa)", 1], ["Seringa 10ml", 1], ["Seringa 3 ml", 1],
  ]},
  { name: "Microagulhamento Capilar", duration: 40, price: 180, sessions: 1, returnDays: 15, products: [
    ["Agulha 13x0.30mm", 1], ["Mescla Alopécia Androgenética", 1], ["Seringa 10ml", 1], ["Babador", 1],
    ["Cartucho dermapen 12 agulhas", 1], ["Luva Descartável Látex com pó Unigloves", 2], ["Agulha 40x 1,20mm (rosa)", 1],
  ]},
  { name: "Microagulhamento Facial", duration: 40, price: 170, sessions: 1, returnDays: 7, products: [
    ["Babador", 1], ["Cartucho dermapen 12 agulhas", 1], ["Dermo CaHa", 1],
    ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2], // Babador repetido → soma p/ 2
  ]},
  { name: "PEIM", duration: 60, price: 150, sessions: 1, returnDays: 15, products: [
    ["Agulha 13x0.30mm", 10], ["Glicose 75% 10ml", 1], ["Agulha 40x 1,20mm (rosa)", 1],
    ["Seringa 1ml Descarpack", 1], ["Luva Descartável Látex com pó Unigloves", 2], ["Babador", 1],
  ]},
  { name: "Peeling Químico", duration: 60, price: 100, sessions: 1, returnDays: 15, products: [
    ["Luva Descartável Látex com pó Unigloves", 1], ["Babador", 1],
  ]},
  { name: "Preenchimento Bigode Chinês", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Microcânula 22x50mm", 1], ["Restylane Gel", 1], ["Seringa 1ml Descarpack", 1], ["Xylestesin sem vasoconstritor", 1],
  ]},
  { name: "Preenchimento Malar", duration: 60, price: 900, products: [
    ["Babador", 1], ["Agulha 13x0.30mm", 1], ["Seringa 1ml Descarpack", 1],
    ["Luva Descartável Látex com pó Unigloves", 2], ["Restylane Lyft", 1], ["Xylestesin sem vasoconstritor", 1],
  ]},
  { name: "Preenchimento Mandíbula", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Microcânula 22x50mm", 1], ["Rennova Ultra Volume", 1], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1],
  ]},
  { name: "Preenchimento Olheiras", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Microcânula 22x50mm", 1], ["Restylane Gel", 1], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1],
  ]},
  { name: "Preenchimento Pré Jowls", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Microcânula 22x50mm", 1], ["Rennova Ultra Volume", 1], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1],
  ]},
  { name: "Preenchimento Queixo", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 1],
    ["Rennova Lift Plus", 1], ["Seringa 1ml Descarpack", 1], ["Xylestesin sem vasoconstritor", 1],
  ]},
  { name: "Preenchimento Tempôras", duration: 60, price: 0, products: [
    ["Babador", 1], ["Restylane Gel", 1], ["Agulha 13x0.30mm", 1],
    ["Luva Descartável Látex com pó Unigloves", 2], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1], ["Microcânula 22x50mm", 1],
  ]},
  { name: "Preenchimento labial", duration: 60, price: 900, products: [
    ["Agulha 13x0.30mm", 1], ["Juvéderm Ultra Plus Xc", 1], ["Microcânula 22x50mm", 1],
    ["Luva Descartável Látex com pó Unigloves", 1], ["Babador", 1], ["Xylestesin sem vasoconstritor", 1], ["Seringa 1ml Descarpack", 1],
  ]},
  { name: "Radiesse", duration: 60, price: 1700, products: [
    ["Agulha 13x0.30mm", 1], ["Seringa 3 ml", 1], ["Babador", 1], ["Luva Descartável Látex com pó Unigloves", 2],
    ["Microcânula 22x50mm", 1], ["Radiesse", 1], ["Seringa 10ml", 2], ["Seringa 1ml Descarpack", 1],
    ["Soro fisiológico (flaconete)", 1], ["Xylestesin sem vasoconstritor", 1],
  ]},
  { name: "Retorno", duration: 30, price: 0, products: [] },
  { name: "Rinomodelação", duration: 60, price: 1300, products: [
    ["Agulha 13x0.30mm", 1], ["Restylane Lyft", 1], ["Xylestesin sem vasoconstritor", 1],
    ["Seringa 1ml Descarpack", 1], ["Microcânula 22x50mm", 1], ["Babador", 1],
  ]},
  { name: "Sculptra", duration: 60, price: 2200, products: [
    ["Sculptra", 1], ["Água de injeção", 1], ["Xylestesin sem vasoconstritor", 1], ["Agulha 13x0.30mm", 1],
    ["Seringa 1ml Descarpack", 1], ["Seringa 10ml", 1], ["Agulha 40x 1,20mm (rosa)", 1], ["Seringa 3 ml", 1],
    ["Microcânula 22x50mm", 1], ["Luva Descartável Látex com pó Unigloves", 2], ["Babador", 1],
  ]},
  { name: "Toxina Botulínica 3 regiões", duration: 60, price: 950, products: [
    ["Dysport 500sp", 1], ["Babador", 1], ["Seringa Insulina Sol M", 2], ["Luva Descartável Látex com pó Unigloves", 2],
  ]},
  { name: "Toxina Botulínica em Sorriso Gengival", duration: 30, price: 250, products: [
    ["Babador", 1], ["Seringa Insulina Sol M", 1], ["Dysport 500sp", 1],
  ]},
  { name: "Toxina botulínica Glabela", duration: 30, price: 400, products: [] },
  { name: "Toxina botulínica full face", duration: 60, price: 1500, products: [
    ["Dysport 500sp", 1], ["Babador", 1], ["Seringa Insulina Sol M", 2],
  ]},
];

async function main() {
  const email = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!email) {
    console.error("❌ Informe o e-mail: node scripts/migrate-procedures.js <email> [--commit]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`❌ Nenhum usuário com e-mail "${email}".`); process.exit(1); }

  console.log(`\n👤 Conta: ${user.name} <${user.email}> (id: ${user.id})`);
  console.log(`\n${commit ? "🟢 MODO COMMIT — vai gravar." : "🟡 DRY-RUN — nada será gravado. Use --commit para gravar."}\n`);

  const norm = (s) => (s || "").trim().toLowerCase();

  // Índice de produtos do usuário por nome → productId.
  const stockProducts = await prisma.product.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  const productByName = new Map(stockProducts.map((p) => [norm(p.name), p]));

  // Procedimentos já existentes (upsert por nome).
  const existing = await prisma.procedure.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  const procByName = new Map(existing.map((p) => [norm(p.name), p]));

  let toCreate = 0, toUpdate = 0;
  const missingProducts = new Set();
  let linkedCount = 0, customCount = 0;

  for (const proc of PROCEDURES) {
    const match = procByName.get(norm(proc.name));
    const action = match ? "ATUALIZA" : "CRIA";
    match ? toUpdate++ : toCreate++;

    // Soma quantidades de produto repetido no mesmo procedimento.
    const merged = new Map(); // norm(name) → { name, qty }
    for (const [pname, qty] of proc.products) {
      const k = norm(pname);
      if (merged.has(k)) merged.get(k).qty += qty;
      else merged.set(k, { name: pname, qty });
    }

    const productLinks = [];
    for (const { name, qty } of merged.values()) {
      const sp = productByName.get(norm(name));
      if (sp) { productLinks.push({ productId: sp.id, quantity: qty, perSession: true }); linkedCount++; }
      else { productLinks.push({ customName: name, quantity: qty, perSession: true }); customCount++; missingProducts.add(name); }
    }

    const sessoes = proc.sessions ? ` · ${proc.sessions}sess/${proc.returnDays}d` : "";
    console.log(`  ${action.padEnd(8)} ${proc.name.padEnd(42)} R$${String(proc.price).padStart(5)} · ${proc.duration}min${sessoes} · ${productLinks.length} prod`);

    if (commit) {
      const data = {
        name: proc.name,
        price: proc.price,
        duration: proc.duration,
        hasMultipleSessions: !!proc.sessions,
        requiresReturn: !!proc.returnDays,
        returnDays: proc.returnDays ?? null,
      };
      if (match) {
        await prisma.procedureProduct.deleteMany({ where: { procedureId: match.id } });
        await prisma.procedure.update({
          where: { id: match.id },
          data: { ...data, products: { create: productLinks } },
        });
      } else {
        await prisma.procedure.create({
          data: { ...data, userId: user.id, products: { create: productLinks } },
        });
      }
    }
  }

  console.log(`\n📊 ${toCreate} a criar · ${toUpdate} a atualizar · ${PROCEDURES.length} procedimentos`);
  console.log(`🔗 Vínculos: ${linkedCount} ligados ao estoque · ${customCount} como texto (produto não encontrado)`);
  if (missingProducts.size > 0) {
    console.log(`\n⚠️ Produtos citados mas NÃO cadastrados (viram texto livre, sem baixa de estoque):`);
    [...missingProducts].forEach((m) => console.log(`   - ${m}`));
    console.log(`   → Rode migrate-products.js antes, ou confira grafia.`);
  }
  console.log(commit ? "\n✅ Gravado.\n" : "\nℹ️  Rode com --commit para gravar.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
