import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USER_EMAIL = "eurianebiomedica@gmail.com";

const PRODUCTS = [
  {
    key: "toxina",
    name: "Toxina Botulínica 100U",
    description: "Frasco genérico de toxina botulínica para procedimentos faciais.",
    unit: "frasco",
  },
  {
    key: "acido-hialuronico",
    name: "Ácido Hialurônico 1ml",
    description: "Seringa genérica de ácido hialurônico para preenchimentos.",
    unit: "seringa",
  },
  {
    key: "radiesse",
    name: "Bioestimulador Radiesse 1,5ml",
    description: "Produto genérico para bioestimulação com hidroxiapatita de cálcio.",
    unit: "seringa",
  },
  {
    key: "fios-pdo",
    name: "Fios de PDO",
    description: "Fios genéricos de polidioxanona para lifting e bioestimulação.",
    unit: "unidade",
  },
  {
    key: "cartucho-microagulhamento",
    name: "Cartucho de Microagulhamento",
    description: "Cartucho descartável para microagulhamento.",
    unit: "unidade",
  },
  {
    key: "drug-delivery",
    name: "Ativo para Drug Delivery",
    description: "Ativo genérico para associação ao microagulhamento.",
    unit: "ampola",
  },
  {
    key: "kit-limpeza",
    name: "Kit Limpeza de Pele",
    description: "Kit genérico de insumos para limpeza de pele profunda.",
    unit: "kit",
  },
  {
    key: "agulha-canula",
    name: "Agulha/Cânula descartável",
    description: "Insumo descartável genérico para aplicações injetáveis.",
    unit: "unidade",
  },
  {
    key: "seringa",
    name: "Seringa descartável 1ml",
    description: "Seringa descartável genérica para procedimentos estéticos.",
    unit: "unidade",
  },
];

const PROCEDURES = [
  {
    name: "Toxina Botulínica — Glabela",
    category: "Toxina Botulínica",
    description: "Aplicação de toxina botulínica na região da glabela (linhas entre as sobrancelhas).",
    price: 650,
    duration: 30,
    requiresReturn: true,
    returnDays: 14,
    products: [{ key: "toxina", quantity: 0.35 }, { key: "agulha-canula", quantity: 1 }, { key: "seringa", quantity: 1 }],
  },
  {
    name: "Toxina Botulínica — Frontal + Glabela + Orbicular",
    category: "Toxina Botulínica",
    description: "Tratamento completo de terço superior: testa, glabela e região periorbital.",
    price: 1200,
    duration: 45,
    requiresReturn: true,
    returnDays: 14,
    products: [{ key: "toxina", quantity: 0.75 }, { key: "agulha-canula", quantity: 1 }, { key: "seringa", quantity: 1 }],
  },
  {
    name: "Preenchimento Labial — 1 seringa",
    category: "Preenchimento",
    description: "Preenchimento dos lábios com ácido hialurônico para volume, contorno e hidratação.",
    price: 950,
    duration: 45,
    requiresReturn: true,
    returnDays: 14,
    products: [{ key: "acido-hialuronico", quantity: 1 }, { key: "agulha-canula", quantity: 1 }],
  },
  {
    name: "Preenchimento Malar (Maçã do Rosto)",
    category: "Preenchimento",
    description: "Restauração do volume malar com ácido hialurônico de alta coesividade.",
    price: 1800,
    duration: 60,
    requiresReturn: true,
    returnDays: 14,
    products: [{ key: "acido-hialuronico", quantity: 2 }, { key: "agulha-canula", quantity: 1 }],
  },
  {
    name: "Bioestimulador de Colágeno — Radiesse",
    category: "Bioestimulador",
    description: "Aplicação de hidroxiapatita de cálcio para estímulo de colágeno e melhora da pele.",
    price: 2200,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 60,
    products: [{ key: "radiesse", quantity: 1 }, { key: "agulha-canula", quantity: 1 }, { key: "seringa", quantity: 1 }],
  },
  {
    name: "Harmonização Facial Completa",
    category: "Procedimentos Faciais",
    description: "Protocolo completo de harmonização com análise facial, preenchimentos e toxina botulínica.",
    price: 4500,
    duration: 120,
    requiresReturn: true,
    returnDays: 14,
    products: [{ key: "toxina", quantity: 1 }, { key: "acido-hialuronico", quantity: 3 }, { key: "agulha-canula", quantity: 2 }],
  },
  {
    name: "Fios de PDO — Lifting Facial",
    category: "Procedimentos Faciais",
    description: "Implante de fios de PDO para tração mecânica e bioestimulação.",
    price: 3200,
    duration: 90,
    requiresReturn: true,
    returnDays: 30,
    products: [{ key: "fios-pdo", quantity: 8 }, { key: "agulha-canula", quantity: 1 }],
  },
  {
    name: "Microagulhamento com Drug Delivery",
    category: "Estética Avançada",
    description: "Microagulhamento mecanizado com aplicação de ativos para estímulo de colágeno.",
    price: 700,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
    products: [{ key: "cartucho-microagulhamento", quantity: 1 }, { key: "drug-delivery", quantity: 1 }],
  },
  {
    name: "Limpeza de Pele Profunda",
    category: "Estética Avançada",
    description: "Protocolo de higienização, esfoliação, extração e hidratação da pele.",
    price: 280,
    duration: 60,
    hasMultipleSessions: true,
    requiresReturn: true,
    returnDays: 30,
    products: [{ key: "kit-limpeza", quantity: 1 }],
  },
];

async function upsertProduct(userId, product) {
  const existing = await prisma.product.findFirst({
    where: { userId, name: product.name },
  });
  if (existing) return existing;

  return prisma.product.create({
    data: {
      name: product.name,
      description: product.description,
      unit: product.unit,
      stock: 0,
      minStock: 0,
      userId,
    },
  });
}

async function upsertProcedure(userId, procedure, productsByKey) {
  let record = await prisma.procedure.findFirst({
    where: { userId, name: procedure.name },
  });

  const data = {
    description: procedure.description,
    category: procedure.category,
    duration: procedure.duration,
    price: procedure.price,
    hasMultipleSessions: procedure.hasMultipleSessions ?? false,
    requiresReturn: procedure.requiresReturn ?? false,
    returnDays: procedure.returnDays ?? null,
  };

  if (record) {
    await prisma.procedureProduct.deleteMany({ where: { procedureId: record.id } });
    record = await prisma.procedure.update({
      where: { id: record.id },
      data,
    });
  } else {
    record = await prisma.procedure.create({
      data: {
        name: procedure.name,
        ...data,
        userId,
      },
    });
  }

  for (const item of procedure.products) {
    const product = productsByKey.get(item.key);
    if (!product) continue;
    await prisma.procedureProduct.create({
      data: {
        procedureId: record.id,
        productId: product.id,
        quantity: item.quantity,
        perSession: true,
      },
    });
  }

  return record;
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true, email: true },
  });

  if (!user) throw new Error(`Usuária não encontrada: ${USER_EMAIL}`);

  const productsByKey = new Map();
  for (const product of PRODUCTS) {
    const record = await upsertProduct(user.id, product);
    productsByKey.set(product.key, record);
  }

  for (const procedure of PROCEDURES) {
    await upsertProcedure(user.id, procedure, productsByKey);
  }

  const [procedures, products, links] = await Promise.all([
    prisma.procedure.count({ where: { userId: user.id } }),
    prisma.product.count({ where: { userId: user.id } }),
    prisma.procedureProduct.count({
      where: { procedure: { userId: user.id } },
    }),
  ]);

  console.log(`Catálogo aplicado para ${user.name} (${user.email})`);
  console.log(`${PROCEDURES.length} procedimentos-alvo processados`);
  console.log(`${PRODUCTS.length} produtos-alvo processados`);
  console.log(`Totais da usuária: ${procedures} procedimentos, ${products} produtos, ${links} vínculos procedimento-produto`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
