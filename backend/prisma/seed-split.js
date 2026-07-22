import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Valores iniciais do Split IASOPay. Idempotente: cria o que faltar e NÃO
// sobrescreve linhas já existentes (para não desfazer ajustes feitos no painel).
//   PERCENTAGE → splitValue em % (0.20 = 0,20%)
//   FIXED      → splitValue em R$ (0.20 = R$ 0,20)
const DEFAULTS = [
  { paymentMethod: "credit_card", splitType: "PERCENTAGE", splitValue: 0.20 },
  { paymentMethod: "pix",         splitType: "FIXED",      splitValue: 0.20 },
  { paymentMethod: "boleto",      splitType: "FIXED",      splitValue: 0.20 },
];

async function main() {
  for (const cfg of DEFAULTS) {
    const row = await prisma.splitConfig.upsert({
      where:  { paymentMethod: cfg.paymentMethod },
      update: {}, // preserva o que já existe
      create: { ...cfg, active: true },
    });
    console.log(
      `[seed-split] ${row.paymentMethod}: ${row.splitType} ${row.splitValue} (active=${row.active})`
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
