import { prisma } from "../../config/prisma.js";

// Respostas de IA CHUMBADAS para contas demo. A demo NUNCA chama o Claude:
// nada de queimar créditos nem depender de serviço externo. Cada função devolve
// um exemplo coerente, no mesmo formato que o ai.service real retornaria.

const RESUMO_MOCK =
  "Paciente com bom histórico de adesão. Realizou limpeza de pele e avaliação facial nos últimos meses, " +
  "sem intercorrências relatadas. Pele reativa — recomenda-se manter ativos suaves. Boa candidata a protocolo " +
  "de rejuvenescimento. (Resumo de exemplo — na conta real, gerado por IA a partir do histórico do paciente.)";

const EVOLUTION_MOCK =
  "Paciente compareceu para o procedimento previsto. Realizada assepsia da região e aplicação conforme protocolo. " +
  "Sem intercorrências durante a sessão. Orientada quanto aos cuidados pós-procedimento: evitar exposição solar, " +
  "manter hidratação e retornar em caso de qualquer reação. (Rascunho de exemplo — na conta real, gerado por IA.)";

export const aiDemo = {
  patientSummary: () => RESUMO_MOCK,

  evolutionDraft: () => EVOLUTION_MOCK,

  // Usa os pacientes reais da demo, mas os "insights" são chumbados.
  returnSuggestions: async (userId) => {
    const patients = await prisma.patient.findMany({
      where: { userId }, select: { id: true, name: true }, take: 3, orderBy: { createdAt: "asc" },
    });
    const procs = ["Limpeza de pele", "Toxina botulínica", "Preenchimento labial"];
    return patients.map((p, i) => {
      const daysOverdue = [12, -3, 5][i] ?? 0;
      return {
        name: p.name, patientId: p.id, procedureName: procs[i % procs.length],
        lastVisit: new Date(Date.now() - 40 * 86400000).toISOString(),
        returnDate: new Date(Date.now() + daysOverdue * -86400000).toISOString(),
        returnDays: 30, daysOverdue,
        status: daysOverdue > 0 ? "atrasado" : "proximo",
        suggestion: daysOverdue > 0
          ? `Retorno de ${procs[i % procs.length]} venceu há ${daysOverdue} dias — vale um contato. (exemplo)`
          : `Retorno de ${procs[i % procs.length]} previsto em breve. (exemplo)`,
      };
    });
  },

  financialHealth: () => ({
    score: 78,
    resumo: "Fluxo saudável no geral, com atenção a recebimentos pendentes. (Análise de exemplo — não é IA real.)",
    alerts: [
      { severity: "alerta", titulo: "Recebimentos pendentes", descricao: "Há cobranças em aberto que valem acompanhamento." },
      { severity: "info", titulo: "Boa margem no mês", descricao: "As receitas superaram as despesas fixas do período." },
    ],
  }),

  productHealth: () => ({
    score: 85,
    resumo: "Controle de estoque consistente, com 1 item abaixo do mínimo. (Análise de exemplo — não é IA real.)",
    alerts: [
      { severity: "alerta", titulo: "Estoque baixo", descricao: "Álcool 70% está abaixo do estoque mínimo." },
    ],
  }),

  chat: () =>
    "Esta é uma resposta de exemplo do assistente. Na conta real, a IA responde às suas dúvidas com base nos " +
    "dados da sua clínica. Contrate para ativar a IA de verdade. 🙂",

  chatReports: () =>
    "Na conta real, eu analiso seus relatórios e respondo em linguagem natural (faturamento, ticket médio, " +
    "retornos etc.). Esta é uma resposta de demonstração. ✨",

  dailyInsight: () =>
    "Cuidar de pessoas é também cuidar dos detalhes — que seu dia seja leve e produtivo.",
};
