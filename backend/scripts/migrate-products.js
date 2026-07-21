// ─────────────────────────────────────────────────────────────────────────────
// Migração pontual de produtos de uma clínica (sistema antigo → Iaso).
//
// Uso:
//   node scripts/migrate-products.js <email-da-conta>            # DRY-RUN (não grava)
//   node scripts/migrate-products.js <email-da-conta> --commit   # grava de verdade
//
// - Identifica a conta pelo e-mail (User.email é único).
// - Upsert por NOME: se já existe um produto com o mesmo nome para aquele
//   usuário, atualiza; senão, cria. Assim rodar 2x não duplica.
// - Estoque inicial 0 (a clínica passa a lançar as compras no Iaso).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../src/config/prisma.js";

const CATEGORIA = { DESC: "descartáveis", INS: "insumos" };

// Dados vindos da lista da clínica (nome, categoria, fornecedor, preço unit., estoque mínimo).
// Estoque inicial = 0 em todos (fonte única passa a ser o Iaso).
const PRODUCTS = [
  { name: "Agulha 13x0.30mm",                              category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.18,   minStock: 5 },
  { name: "Agulha 22x 0,55 (roxa)",                        category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.19,   minStock: 5 },
  { name: "Agulha 25x 0,80 21g (verde)",                   category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.19,   minStock: 5 },
  { name: "Agulha 40x 1,20mm (rosa)",                      category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.19,   minStock: 5 },
  { name: "Babador",                                       category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.24,   minStock: 5 },
  { name: "Cartucho dermapen 12 agulhas",                  category: CATEGORIA.DESC, supplier: "Mais Creme",    unitPrice: 24.90,  minStock: 5 },
  { name: "Dermo CaHa",                                    category: CATEGORIA.INS,  supplier: "Mais creme",    unitPrice: 50.00,  minStock: 5 },
  { name: "Dysport 500sp",                                 category: CATEGORIA.INS,  supplier: "Galderma",      unitPrice: 6.75,   minStock: 5 },
  { name: "Fio filler",                                    category: CATEGORIA.INS,  supplier: "Ithread",       unitPrice: 92.05,  minStock: null },
  { name: "Glicose 75% 10ml",                              category: CATEGORIA.INS,  supplier: "Victa",         unitPrice: 4.46,   minStock: 5 },
  { name: "Hialuronidase",                                 category: CATEGORIA.INS,  supplier: "Victa",         unitPrice: 41.90,  minStock: 5 },
  { name: "Juvéderm Ultra Plus Xc",                        category: CATEGORIA.INS,  supplier: "Allergan",      unitPrice: 319.50, minStock: 5 },
  { name: "Luva Descartável Látex com pó Unigloves",       category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.35,   minStock: 5 },
  { name: "Mescla Alopécia Androgenética",                 category: CATEGORIA.INS,  supplier: "Victa",         unitPrice: 28.74,  minStock: 5 },
  { name: "Mescla Lipossomada c/ Ácido Desoxicólico",      category: CATEGORIA.INS,  supplier: "Victa",         unitPrice: 27.17,  minStock: 5 },
  { name: "Microcânula 22x50mm",                           category: CATEGORIA.DESC, supplier: "Rennova",       unitPrice: 13.99,  minStock: 5 },
  { name: "Radiesse",                                      category: CATEGORIA.INS,  supplier: "Merz",          unitPrice: 689.00, minStock: 5 },
  { name: "Rennova Lift Plus",                             category: CATEGORIA.INS,  supplier: "Rennova",       unitPrice: 298.99, minStock: 5 },
  { name: "Rennova Ultra Volume",                          category: CATEGORIA.INS,  supplier: "Rennova",       unitPrice: 278.99, minStock: 5 },
  { name: "Restylane Defyne",                              category: CATEGORIA.INS,  supplier: "Galderma",      unitPrice: 439.00, minStock: 5 },
  { name: "Restylane Gel",                                 category: CATEGORIA.INS,  supplier: "Galderma",      unitPrice: 319.00, minStock: 5 },
  { name: "Restylane Lyft",                                category: CATEGORIA.INS,  supplier: "Galderma",      unitPrice: 369.00, minStock: 5 },
  { name: "Sculptra",                                      category: CATEGORIA.INS,  supplier: "Galderma",      unitPrice: 899.00, minStock: 5 },
  { name: "Seringa 10ml",                                  category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.79,   minStock: 5 },
  { name: "Seringa 1ml Descarpack",                        category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.39,   minStock: 5 },
  { name: "Seringa 3 ml",                                  category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 0.49,   minStock: 5 },
  { name: "Seringa Insulina Sol M",                        category: CATEGORIA.DESC, supplier: "Mercado Livre", unitPrice: 1.29,   minStock: 5 },
  { name: "Soro fisiológico (flaconete)",                  category: CATEGORIA.INS,  supplier: "Shopee",        unitPrice: 0.78,   minStock: 5 },
  { name: "Xylestesin com vasoconstritor",                category: CATEGORIA.INS,  supplier: "Chris Medic",   unitPrice: 19.00,  minStock: 5 },
  { name: "Xylestesin sem vasoconstritor",                category: CATEGORIA.INS,  supplier: "Chris Medic",   unitPrice: 19.00,  minStock: 5 },
  { name: "Água de injeção",                               category: CATEGORIA.INS,  supplier: "Mercado Livre", unitPrice: 1.78,   minStock: 5 },
];

const DEFAULT_UNIT = "un";

async function main() {
  const email = process.argv[2];
  const commit = process.argv.includes("--commit");

  if (!email) {
    console.error("❌ Informe o e-mail da conta: node scripts/migrate-products.js <email> [--commit]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ Nenhum usuário com e-mail "${email}".`);
    process.exit(1);
  }

  console.log(`\n👤 Conta: ${user.name} <${user.email}>  (id: ${user.id})`);
  console.log(`   Clínica: ${user.clinicName || "—"}`);
  console.log(`\n${commit ? "🟢 MODO COMMIT — vai gravar no banco." : "🟡 DRY-RUN — nada será gravado. Use --commit para gravar."}\n`);

  const existing = await prisma.product.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]));

  let toCreate = 0, toUpdate = 0;

  for (const p of PRODUCTS) {
    const match = byName.get(p.name.trim().toLowerCase());
    const action = match ? "ATUALIZA" : "CRIA";
    if (match) toUpdate++; else toCreate++;

    const preco = p.unitPrice != null
      ? p.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";
    console.log(
      `  ${action.padEnd(8)} ${p.name.padEnd(45)} ${String(p.category).padEnd(13)} ${String(p.supplier).padEnd(15)} ${preco}`
    );

    if (commit) {
      const data = {
        name: p.name,
        category: p.category,
        supplier: p.supplier,
        unitPrice: p.unitPrice,
        minStock: p.minStock,
        unit: DEFAULT_UNIT,
        stock: 0,
      };
      if (match) {
        await prisma.product.update({ where: { id: match.id }, data });
      } else {
        await prisma.product.create({ data: { ...data, userId: user.id } });
      }
    }
  }

  console.log(`\n📊 Resumo: ${toCreate} a criar · ${toUpdate} a atualizar · ${PRODUCTS.length} total`);
  console.log(commit ? "✅ Gravado no banco.\n" : "ℹ️  Rode de novo com --commit para gravar.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
