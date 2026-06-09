/**
 * Seed: procedimentos realistas para clínica de harmonização facial / estética
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROCEDURES = [
  // ── TOXINA BOTULÍNICA ──────────────────────────────────────────────────────
  {
    name: "Toxina Botulínica — Glabela",
    category: "Toxina Botulínica",
    description: "Aplicação de toxina botulínica na região da glabela (linhas entre as sobrancelhas). Suaviza as linhas de expressão verticais causadas pela contração dos músculos corrugadores.",
    price: 650,
    duration: 30,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Toxina Botulínica — Frontal + Glabela + Orbicular",
    category: "Toxina Botulínica",
    description: "Tratamento completo de terço superior: testa, glabela e região periorbital (pés de galinha). Harmoniza expressões faciais e suaviza linhas dinâmicas.",
    price: 1200,
    duration: 45,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Toxina Botulínica — Masseter (Bruxismo / Slim Face)",
    category: "Toxina Botulínica",
    description: "Aplicação bilateral no músculo masseter para tratamento de bruxismo e para afinar o contorno mandibular (efeito slim face). Resultado mais evidente em 4–6 semanas.",
    price: 1400,
    duration: 30,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 30,
  },
  {
    name: "Toxina Botulínica — Pescoço (Bandas Platismais)",
    category: "Toxina Botulínica",
    description: "Aplicação nas bandas do músculo platisma para reduzir as cordas verticais no pescoço, promovendo efeito de rejuvenescimento cervical (Nefertiti Lift).",
    price: 900,
    duration: 30,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },

  // ── PREENCHIMENTO ──────────────────────────────────────────────────────────
  {
    name: "Preenchimento Labial — 1 seringa",
    category: "Preenchimento",
    description: "Preenchimento dos lábios com ácido hialurônico para aumento de volume, definição do contorno e hidratação. Resultado natural e harmonioso com a face.",
    price: 950,
    duration: 45,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Preenchimento Malar (Maçã do Rosto)",
    category: "Preenchimento",
    description: "Restauração do volume malar com ácido hialurônico de alta coesividade. Eleva e estrutura o terço médio da face, combatendo o aspecto de envelhecimento por perda de volume.",
    price: 1800,
    duration: 60,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Preenchimento de Olheiras (Tear Trough)",
    category: "Preenchimento",
    description: "Preenchimento delicado do sulco nasojugal com ácido hialurônico. Atenua as olheiras volumétricas e suaviza a transição entre pálpebra e bochechas.",
    price: 1600,
    duration: 60,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 21,
  },
  {
    name: "Preenchimento de Queixo e Mento",
    category: "Preenchimento",
    description: "Estruturação do queixo com ácido hialurônico para melhorar o perfil facial, definir o contorno mandibular e harmonizar o terço inferior da face.",
    price: 1500,
    duration: 45,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },

  // ── BIOESTIMULADORES ───────────────────────────────────────────────────────
  {
    name: "Bioestimulador de Colágeno — Radiesse",
    category: "Bioestimulador",
    description: "Aplicação de hidroxiapatita de cálcio (Radiesse) para estimulação da produção de colágeno, volumização e melhora da qualidade da pele. Resultado progressivo em 4–8 semanas.",
    price: 2200,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 60,
  },
  {
    name: "Bioestimulador de Colágeno — Sculptra",
    category: "Bioestimulador",
    description: "Ácido poli-L-láctico (Sculptra) para neocolagênese progressiva. Protocolo de 2 a 3 sessões para restauração volumétrica natural e melhora da textura cutânea.",
    price: 2800,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 45,
  },

  // ── PROCEDIMENTOS FACIAIS ──────────────────────────────────────────────────
  {
    name: "Rinoplastia Não-Cirúrgica",
    category: "Procedimentos Faciais",
    description: "Remodelação do nariz com ácido hialurônico para corrigir pequenas imperfeições, elevar a ponta nasal ou suavizar o dorso sem cirurgia. Resultado imediato.",
    price: 1800,
    duration: 60,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Harmonização Facial Completa",
    category: "Procedimentos Faciais",
    description: "Protocolo completo de harmonização: análise dos terços faciais, preenchimento de múltiplas regiões e toxina botulínica. Planejamento individualizado com mapa facial.",
    price: 4500,
    duration: 120,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 14,
  },
  {
    name: "Fios de PDO — Lifting Facial",
    category: "Procedimentos Faciais",
    description: "Implante de fios de polidioxanona (PDO) para tração mecânica e bioestimulação. Reposiciona tecidos flácidos do rosto e pescoço com resultado imediato e progressivo.",
    price: 3200,
    duration: 90,
    hasMultipleSessions: false,
    requiresReturn: true,
    returnDays: 30,
  },
  {
    name: "Skinbooster (Hidratação Profunda)",
    category: "Procedimentos Faciais",
    description: "Microinjeções dérmicas de ácido hialurônico não reticulado para hidratação intensa, melhora da elasticidade e luminosidade da pele. Protocolo de 3 sessões mensais.",
    price: 1100,
    duration: 45,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
  },
  {
    name: "PRP — Plasma Rico em Plaquetas",
    category: "Procedimentos Faciais",
    description: "Coleta e processamento do sangue do paciente para obtenção de plasma concentrado em plaquetas. Aplicação facial para rejuvenescimento, cicatrização e estímulo de colágeno.",
    price: 1400,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
  },

  // ── ESTÉTICA AVANÇADA ──────────────────────────────────────────────────────
  {
    name: "Microagulhamento com Drug Delivery",
    category: "Estética Avançada",
    description: "Microagulhamento mecanizado com aplicação de ativos (vitamina C, retinol, peptídeos). Estimula colágeno, melhora textura, poros, manchas e cicatrizes de acne.",
    price: 700,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
  },
  {
    name: "Peeling Químico Médio (TCA)",
    category: "Estética Avançada",
    description: "Aplicação de ácido tricloroacético para renovação celular profunda. Indicado para manchas, melasma, envelhecimento e textura irregular da pele.",
    price: 600,
    duration: 45,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 21,
  },
  {
    name: "Laser Fracionado CO₂",
    category: "Estética Avançada",
    description: "Ablação fracionada com laser CO₂ para resurfacing cutâneo. Alta eficácia para cicatrizes, rugas finas, textura e manchas. Downtime de 5 a 10 dias.",
    price: 1800,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 60,
  },
  {
    name: "Limpeza de Pele Profunda",
    category: "Estética Avançada",
    description: "Protocolo completo de higienização, esfoliação, extração de comedões e hidratação. Mantém a saúde cutânea e prepara a pele para outros tratamentos.",
    price: 280,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
  },
  {
    name: "Lipodissolução Facial (Papada)",
    category: "Estética Avançada",
    description: "Microinjeções de fosfatidilcolina e deoxicolato de sódio na região submentoniana para dissolução do tecido adiposo localizado. Redução progressiva da papada em 2–3 sessões.",
    price: 1200,
    duration: 45,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 45,
  },
];

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("Nenhum usuário encontrado.");

  console.log(`\n👤 Usuário: ${user.email}\n`);

  let created = 0;
  let skipped = 0;

  for (const proc of PROCEDURES) {
    const existing = await prisma.procedure.findFirst({
      where: { name: proc.name, userId: user.id },
    });

    if (existing) {
      console.log(`  ⏭  Já existe: ${proc.name}`);
      skipped++;
      continue;
    }

    await prisma.procedure.create({
      data: { ...proc, userId: user.id },
    });

    console.log(`  ✅ ${proc.name} — R$ ${proc.price?.toFixed(2)}`);
    created++;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${created} procedimentos criados, ${skipped} já existiam.\n`);

  const byCategory = {};
  for (const p of PROCEDURES) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }
  console.log("Categorias:");
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} procedimentos`);
  });
  console.log();
}

main()
  .catch((e) => { console.error("Erro:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
