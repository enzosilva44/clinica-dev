/**
 * Seed: cenários para testar o Guardião Financeiro
 *
 * Gera 4 situações de alerta:
 *  1. Duplicidade potencial  — mesmo paciente com TX de agendamento + TX de orçamento pendentes
 *  2. Inadimplência          — receita pendente com vencimento 45 dias atrás
 *  3. Agend. sem cobrança    — agendamento COMPLETED sem transação vinculada
 *  4. Parcelas inconsistentes — grupo onde parcela 1 paga e parcela 2 cancelada
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("Nenhum usuário encontrado. Crie uma conta primeiro.");

  console.log(`\n👤 Usuário: ${user.email} (${user.id})\n`);

  // ── 1. DUPLICIDADE POTENCIAL ────────────────────────────────────────────────
  console.log("1️⃣  Criando cenário de duplicidade potencial...");

  const pacienteDup = await prisma.patient.create({
    data: {
      name: "Carolina Mendes [TESTE]",
      phone: "11999990001",
      userId: user.id,
      isActive: true,
    },
  });

  const apptDup = await prisma.appointment.create({
    data: {
      title: "Harmonização Facial",
      startsAt: daysAgo(3),
      endsAt: new Date(daysAgo(3).getTime() + 60 * 60 * 1000),
      procedureType: "Toxina Botulínica",
      status: "SCHEDULED",
      patientId: pacienteDup.id,
      userId: user.id,
    },
  });

  // TX vinculada ao agendamento
  await prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: "Toxina Botulínica - Agendamento",
      amount: 850,
      category: "Procedimento",
      dueDate: daysFromNow(7),
      appointmentId: apptDup.id,
      patientId: pacienteDup.id,
      userId: user.id,
    },
  });

  const budgetDup = await prisma.budget.create({
    data: {
      title: "Orçamento Harmonização Facial",
      subtotal: 850,
      discount: 0,
      total: 850,
      patientId: pacienteDup.id,
      userId: user.id,
    },
  });

  // TX vinculada ao orçamento (mesmo caso → duplicidade)
  await prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: "Harmonização Facial - Orçamento",
      amount: 850,
      category: "Procedimento",
      dueDate: daysFromNow(10),
      budgetId: budgetDup.id,
      patientId: pacienteDup.id,
      userId: user.id,
    },
  });

  console.log(`   ✅ Paciente: ${pacienteDup.name} — 2 transações pendentes (agendamento + orçamento = R$ 1.700 em risco)\n`);

  // ── 2. INADIMPLÊNCIA ────────────────────────────────────────────────────────
  console.log("2️⃣  Criando cenário de inadimplência...");

  const pacienteInad = await prisma.patient.create({
    data: {
      name: "Roberto Carvalho [TESTE]",
      phone: "11999990002",
      userId: user.id,
      isActive: true,
    },
  });

  await prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: "Preenchimento Labial - vencida",
      amount: 1200,
      category: "Procedimento",
      dueDate: daysAgo(45), // venceu há 45 dias
      patientId: pacienteInad.id,
      userId: user.id,
    },
  });

  await prisma.transaction.create({
    data: {
      type: "receita",
      status: "pendente",
      description: "Bioestimulador - vencida",
      amount: 1800,
      category: "Procedimento",
      dueDate: daysAgo(20), // venceu há 20 dias
      patientId: pacienteInad.id,
      userId: user.id,
    },
  });

  console.log(`   ✅ Paciente: ${pacienteInad.name} — R$ 3.000 vencidos há 20-45 dias\n`);

  // ── 3. AGENDAMENTO CONCLUÍDO SEM COBRANÇA ───────────────────────────────────
  console.log("3️⃣  Criando agendamentos concluídos sem transação...");

  const pacienteSemTx = await prisma.patient.create({
    data: {
      name: "Fernanda Lima [TESTE]",
      phone: "11999990003",
      userId: user.id,
      isActive: true,
    },
  });

  await prisma.appointment.create({
    data: {
      title: "Microagulhamento",
      startsAt: daysAgo(10),
      endsAt: new Date(daysAgo(10).getTime() + 90 * 60 * 1000),
      procedureType: "Microagulhamento",
      professional: "Dra. Ana Paula",
      status: "COMPLETED", // concluído mas sem TX
      patientId: pacienteSemTx.id,
      userId: user.id,
    },
  });

  await prisma.appointment.create({
    data: {
      title: "Limpeza de Pele Profunda",
      startsAt: daysAgo(5),
      endsAt: new Date(daysAgo(5).getTime() + 60 * 60 * 1000),
      procedureType: "Limpeza de Pele",
      professional: "Dra. Ana Paula",
      status: "COMPLETED", // concluído mas sem TX
      patientId: pacienteSemTx.id,
      userId: user.id,
    },
  });

  console.log(`   ✅ Paciente: ${pacienteSemTx.name} — 2 agendamentos COMPLETED sem nenhuma cobrança registrada\n`);

  // ── 4. PARCELAS INCONSISTENTES ──────────────────────────────────────────────
  console.log("4️⃣  Criando cenário de parcelas inconsistentes...");

  const pacienteParcela = await prisma.patient.create({
    data: {
      name: "Marcelo Santos [TESTE]",
      phone: "11999990004",
      userId: user.id,
      isActive: true,
    },
  });

  const groupId = randomUUID();
  const totalParcelas = 3;
  const valorParcela = 500;

  await prisma.transaction.createMany({
    data: [
      {
        type: "receita",
        status: "pago",     // parcela 1 paga ✓
        description: `Rinoplastia não-cirúrgica (1/${totalParcelas})`,
        amount: valorParcela,
        category: "Procedimento",
        dueDate: daysAgo(60),
        paidAt: daysAgo(58),
        installments: totalParcelas,
        installmentNumber: 1,
        installmentGroupId: groupId,
        patientId: pacienteParcela.id,
        userId: user.id,
      },
      {
        type: "receita",
        status: "cancelado", // parcela 2 cancelada ← inconsistente
        description: `Rinoplastia não-cirúrgica (2/${totalParcelas})`,
        amount: valorParcela,
        category: "Procedimento",
        dueDate: daysAgo(30),
        installments: totalParcelas,
        installmentNumber: 2,
        installmentGroupId: groupId,
        patientId: pacienteParcela.id,
        userId: user.id,
      },
      {
        type: "receita",
        status: "pendente",  // parcela 3 ainda pendente
        description: `Rinoplastia não-cirúrgica (3/${totalParcelas})`,
        amount: valorParcela,
        category: "Procedimento",
        dueDate: daysFromNow(1),
        installments: totalParcelas,
        installmentNumber: 3,
        installmentGroupId: groupId,
        patientId: pacienteParcela.id,
        userId: user.id,
      },
    ],
  });

  console.log(`   ✅ Paciente: ${pacienteParcela.name} — parcelamento 3x de R$ 500 com parcela 2 cancelada e 1 paga\n`);

  // ── RESUMO ──────────────────────────────────────────────────────────────────
  console.log("━".repeat(60));
  console.log("✅ Dados de teste criados com sucesso!\n");
  console.log("Cenários gerados:");
  console.log("  🔴 Crítico : Duplicidade — Carolina Mendes (R$ 1.700 em risco)");
  console.log("  🔴 Crítico : Inadimplência — Roberto Carvalho (R$ 3.000 vencidos)");
  console.log("  🟡 Alerta  : Agendamento sem cobrança — Fernanda Lima (2 sessões)");
  console.log("  🟡 Alerta  : Parcelas inconsistentes — Marcelo Santos (3x R$ 500)");
  console.log("\nAgora acesse Financeiro → Guardião IA → Analisar agora\n");
}

main()
  .catch((e) => { console.error("Erro:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
