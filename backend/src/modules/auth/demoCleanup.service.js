import { prisma } from "../../config/prisma.js";

// Remove contas demo temporárias já expiradas (demoExpiresAt < agora).
// As relações User → * NÃO têm onDelete: Cascade no schema, então apagamos
// os dependentes explicitamente, em ordem, dentro de uma transação por conta.
// Como a conta demo só contém o que o seed cria (procedimentos, pastas,
// 1 paciente, 1 agendamento), a lista de tabelas abaixo cobre o caso.
export async function cleanupExpiredDemos() {
  const expired = await prisma.user.findMany({
    where: { plan: "demo", demoExpiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let removed = 0;
  for (const { id: userId } of expired) {
    try {
      // Evolution não tem userId (usa patientId/createdById) — apaga pelos
      // pacientes do usuário e pelas evoluções que ele criou.
      const patients = await prisma.patient.findMany({ where: { userId }, select: { id: true } });
      const patientIds = patients.map((p) => p.id);

      await prisma.$transaction([
        // filhos com FK para itens/paciente antes dos pais
        prisma.clubMember.deleteMany({ where: { userId } }),
        prisma.clubPlan.deleteMany({ where: { userId } }),
        prisma.budget.deleteMany({ where: { userId } }),
        prisma.protocol.deleteMany({ where: { userId } }),
        prisma.anamnesisTemplate.deleteMany({ where: { userId } }),
        prisma.transaction.deleteMany({ where: { userId } }),
        prisma.procedureMap.deleteMany({ where: { userId } }),
        prisma.portfolioCase.deleteMany({ where: { userId } }),
        prisma.patientPhoto.deleteMany({ where: { userId } }),
        prisma.evolution.deleteMany({ where: { OR: [{ createdById: userId }, { patientId: { in: patientIds } }] } }),
        prisma.appointment.deleteMany({ where: { userId } }),
        prisma.product.deleteMany({ where: { userId } }),
        prisma.patient.deleteMany({ where: { userId } }),
        prisma.procedure.deleteMany({ where: { userId } }),
        prisma.documentFolder.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
      removed++;
    } catch (e) {
      // Se a conta demo acabou gerando dados fora da lista acima, não derruba
      // o job inteiro — loga e segue para a próxima.
      console.error(`[demoCleanup] falha ao remover demo ${userId}:`, e.message);
    }
  }

  if (removed) console.log(`[demoCleanup] ${removed} conta(s) demo expirada(s) removida(s).`);
  return removed;
}
