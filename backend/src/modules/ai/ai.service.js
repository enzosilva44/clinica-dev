import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../config/prisma.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

function extractJson(text) {
  // Strip markdown code blocks (```json ... ``` or ``` ... ```)
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = stripped.indexOf("{") !== -1 ? stripped.indexOf("{") : stripped.indexOf("[");
  if (start === -1) throw new Error("No JSON found");
  return JSON.parse(stripped.slice(start));
}

// System prompt base — cacheado entre chamadas
const BASE_SYSTEM = {
  type: "text",
  text: `Você é um assistente clínico especializado em harmonização facial e estética médica.
Você faz parte do sistema Iasoclin, um software de gestão para clínicas de estética.
Suas respostas devem ser em português brasileiro, objetivas, técnicas e profissionais.
Nunca invente informações que não estejam nos dados fornecidos.
Não inclua disclaimers genéricos ou aviso de "consulte um médico" — o usuário JÁ É o profissional de saúde.`,
  cache_control: { type: "ephemeral" },
};

export async function generatePatientSummary(patientId, userId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    include: {
      evolutions: {
        orderBy: { createdAt: "asc" },
      },
      appointments: {
        orderBy: { startsAt: "asc" },
        take: 20,
      },
    },
  });

  if (!patient) throw new Error("Paciente não encontrado");

  const evolutions = patient.evolutions;
  const appointments = patient.appointments;

  if (evolutions.length === 0 && appointments.length === 0) {
    throw new Error("Paciente sem histórico registrado");
  }

  const historico = [
    `Paciente: ${patient.name}`,
    patient.birthDate
      ? `Nascimento: ${new Date(patient.birthDate).toLocaleDateString("pt-BR")}`
      : "",
    patient.observations ? `Observações gerais: ${patient.observations}` : "",
    "",
    "=== EVOLUÇÕES CLÍNICAS ===",
    ...evolutions.map((e, i) =>
      [
        `[${i + 1}] ${new Date(e.createdAt).toLocaleDateString("pt-BR")}`,
        e.procedure ? `Procedimento: ${e.procedure}` : "",
        e.description ? `Descrição: ${e.description}` : "",
        e.materials ? `Materiais: ${e.materials}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "",
    "=== AGENDAMENTOS ===",
    ...appointments.map((a) =>
      `${new Date(a.startsAt).toLocaleDateString("pt-BR")} — ${a.procedureType || a.title} (${a.status})`
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Com base no histórico abaixo, gere um resumo clínico conciso (3 a 5 frases) para ser lido rapidamente antes de uma consulta. Inclua: procedimentos realizados, datas relevantes, padrão de resposta e qualquer ponto de atenção. Seja direto e técnico.\n\n${historico}`,
      },
    ],
  });

  return response.content[0].text;
}

export async function generateEvolutionDraft(data) {
  const { procedureName, dose, region, notes, patientName } = data;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Gere um texto de evolução clínica profissional para prontuário médico com base nos dados abaixo.
O texto deve ser em 1 parágrafo, linguagem técnica, primeira pessoa do plural (ex: "Realizamos...").
Não repita os dados brutos — transforme em narrativa clínica.

Paciente: ${patientName || "não informado"}
Procedimento: ${procedureName}
${dose ? `Dose/quantidade: ${dose}` : ""}
${region ? `Região: ${region}` : ""}
${notes ? `Observações do profissional: ${notes}` : ""}`,
      },
    ],
  });

  return response.content[0].text;
}

export async function generateReturnSuggestions(userId) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60); // pacientes sem agendamento há mais de 60 dias

  const patients = await prisma.patient.findMany({
    where: { userId, isActive: true },
    include: {
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 1,
      },
      evolutions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const toReactivate = patients.filter((p) => {
    const lastAppt = p.appointments[0];
    if (!lastAppt) return true;
    return new Date(lastAppt.startsAt) < cutoff;
  });

  if (toReactivate.length === 0) {
    return [];
  }

  const lista = toReactivate
    .slice(0, 20) // máximo 20 por chamada
    .map((p) => {
      const lastAppt = p.appointments[0];
      const lastEvol = p.evolutions[0];
      return [
        `- ${p.name}`,
        lastAppt
          ? `  Último agendamento: ${new Date(lastAppt.startsAt).toLocaleDateString("pt-BR")} (${lastAppt.procedureType || lastAppt.title})`
          : "  Nunca agendou",
        lastEvol
          ? `  Último procedimento registrado: ${lastEvol.procedure || "não informado"}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Com base na lista abaixo de pacientes sem agendamento recente, gere uma sugestão de reativação para cada um.
Para cada paciente, retorne exatamente neste formato JSON (array):
[{"name": "Nome", "suggestion": "mensagem curta de reativação personalizada (1 frase)"}]
Seja específico usando o histórico de procedimento quando disponível. Retorne apenas o JSON, sem explicações.

${lista}`,
      },
    ],
  });

  try {
    return extractJson(response.content[0].text);
  } catch {
    return [];
  }
}

// ─── GUARDIÃO FINANCEIRO ────────────────────────────────────────────────────

export async function analyzeFinancialHealth(userId) {
  const now = new Date();

  // 1. Transações pendentes com vínculos
  const pending = await prisma.transaction.findMany({
    where: { userId, status: "pendente" },
    include: { patient: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  // 2. Duplicidade potencial: mesmo paciente tem TX de agendamento E TX de orçamento pendentes
  const byPatient = {};
  for (const tx of pending) {
    if (!tx.patientId) continue;
    if (!byPatient[tx.patientId]) {
      byPatient[tx.patientId] = { name: tx.patient?.name ?? "—", appt: [], budget: [], other: [] };
    }
    if (tx.appointmentId) byPatient[tx.patientId].appt.push(tx);
    else if (tx.budgetId) byPatient[tx.patientId].budget.push(tx);
    else byPatient[tx.patientId].other.push(tx);
  }

  const duplicates = Object.values(byPatient)
    .filter((g) => g.appt.length > 0 && g.budget.length > 0)
    .map((g) => ({
      paciente: g.name,
      txAgendamento: g.appt.map((t) => ({ descricao: t.description, valor: t.amount, vencimento: t.dueDate })),
      txOrcamento: g.budget.map((t) => ({ descricao: t.description, valor: t.amount, vencimento: t.dueDate })),
      totalEmRisco: [...g.appt, ...g.budget].reduce((s, t) => s + Number(t.amount), 0),
    }));

  // 3. Inadimplência: vencidas há mais de 5 dias
  const overdue = pending
    .filter((t) => t.dueDate && new Date(t.dueDate) < now && t.type === "receita")
    .map((t) => ({
      paciente: t.patient?.name ?? "—",
      descricao: t.description,
      valor: t.amount,
      vencimento: t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : null,
      diasAtraso: t.dueDate ? Math.floor((now - new Date(t.dueDate)) / 86400000) : null,
    }));

  // 4. Agendamentos concluídos sem transação ativa
  const completedNoTx = await prisma.appointment.findMany({
    where: {
      userId,
      status: { in: ["COMPLETED", "FINISHED"] },
      transaction: { is: null },
    },
    include: { patient: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
    take: 20,
  });

  // 5. Parcelas inconsistentes: grupo com parcelas pagas E canceladas simultaneamente
  const installmentGroups = await prisma.transaction.groupBy({
    by: ["installmentGroupId"],
    where: { userId, installmentGroupId: { not: null } },
    _count: { id: true },
  });

  const brokenInstallments = [];
  for (const grp of installmentGroups) {
    if (!grp.installmentGroupId) continue;
    const txs = await prisma.transaction.findMany({
      where: { installmentGroupId: grp.installmentGroupId },
      select: { status: true, description: true, amount: true, installmentNumber: true },
    });
    const statuses = new Set(txs.map((t) => t.status));
    if (statuses.has("pago") && statuses.has("cancelado")) {
      brokenInstallments.push({
        descricao: txs[0]?.description?.replace(/ \(\d+\/\d+\)$/, "") ?? "—",
        parcelas: txs.map((t) => ({ numero: t.installmentNumber, status: t.status, valor: t.amount })),
      });
    }
  }

  const findings = {
    resumo: {
      totalPendente: pending.length,
      valorTotalPendente: pending.reduce((s, t) => s + Number(t.amount), 0),
      duplicidadesPotenciais: duplicates.length,
      vencidasEmAtraso: overdue.length,
      agendamentosSemCobranca: completedNoTx.length,
      parcelasInconsistentes: brokenInstallments.length,
    },
    duplicidades: duplicates,
    inadimplencia: overdue,
    agendamentosSemCobranca: completedNoTx.map((a) => ({
      paciente: a.patient?.name ?? "—",
      procedimento: a.procedureType || a.title,
      data: new Date(a.startsAt).toLocaleDateString("pt-BR"),
    })),
    parcelasInconsistentes: brokenInstallments,
  };

  // Se não há nenhum problema, retorna vazio sem chamar a API
  const totalProblems =
    duplicates.length + overdue.length + completedNoTx.length + brokenInstallments.length;

  if (totalProblems === 0) {
    return {
      alerts: [],
      score: 100,
      resumo: "Nenhum problema detectado no fluxo financeiro.",
    };
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Você é o Guardião Financeiro do Iasoclin. Analise os dados abaixo e gere alertas sobre problemas no fluxo financeiro da clínica.

Retorne APENAS um JSON com este formato exato (sem markdown, sem explicação):
{
  "score": <número 0-100 indicando saúde financeira>,
  "resumo": "<frase resumindo o estado geral>",
  "alerts": [
    {
      "severity": "critico" | "alerta" | "info",
      "tipo": "<categoria curta do problema>",
      "titulo": "<título claro>",
      "descricao": "<explicação do problema e seu impacto financeiro>",
      "pacientes": ["nomes afetados"],
      "valorEmRisco": <número ou null>,
      "acaoSugerida": "<o que fazer para resolver>"
    }
  ]
}

Priorize: crítico = risco imediato de duplicidade ou receita perdida; alerta = atenção necessária; info = oportunidade de melhoria.

DADOS:
${JSON.stringify(findings, null, 2)}`,
      },
    ],
  });

  try {
    return extractJson(response.content[0].text);
  } catch {
    return { alerts: [], score: 50, resumo: "Não foi possível processar a análise." };
  }
}

// ─── CHAT RELATÓRIOS ────────────────────────────────────────────────────────

const REPORT_TOOLS = [
  {
    name: "buscar_pacientes",
    description:
      "Busca e filtra pacientes da clínica. Use para responder perguntas sobre quantidade de pacientes, lista por nome, faixa etária, cidade ou tempo sem retornar.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Busca parcial por nome" },
        idadeMin: { type: "number", description: "Idade mínima em anos (inclusive)" },
        idadeMax: { type: "number", description: "Idade máxima em anos (inclusive)" },
        cidade: { type: "string", description: "Filtrar por cidade (parcial, case-insensitive)" },
        semAgendamentoHaDias: {
          type: "number",
          description: "Retorna apenas pacientes sem agendamento há pelo menos X dias",
        },
        limit: { type: "number", description: "Máximo de pacientes retornados (padrão 30, máx 100)" },
      },
    },
  },
  {
    name: "resumo_financeiro",
    description:
      "Retorna resumo financeiro: total de receitas pagas, despesas pagas, valores pendentes e ticket médio. Passe datas para filtrar por período.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Data inicial YYYY-MM-DD (opcional)" },
        to: { type: "string", description: "Data final YYYY-MM-DD (opcional)" },
      },
    },
  },
  {
    name: "estatisticas_agenda",
    description:
      "Retorna estatísticas de agendamentos: total, por status, procedimentos mais realizados e profissionais. Passe datas para filtrar.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Data inicial YYYY-MM-DD (opcional)" },
        to: { type: "string", description: "Data final YYYY-MM-DD (opcional)" },
      },
    },
  },
];

async function executeTool(name, input, userId) {
  if (name === "buscar_pacientes") {
    const where = { userId, isActive: true };

    if (input.search) where.name = { contains: input.search, mode: "insensitive" };
    if (input.cidade) where.city = { contains: input.cidade, mode: "insensitive" };

    if (input.idadeMin !== undefined || input.idadeMax !== undefined) {
      const today = new Date();
      where.birthDate = {};
      if (input.idadeMax !== undefined) {
        const d = new Date(today);
        d.setFullYear(d.getFullYear() - input.idadeMax);
        where.birthDate.gte = d;
      }
      if (input.idadeMin !== undefined) {
        const d = new Date(today);
        d.setFullYear(d.getFullYear() - input.idadeMin - 1);
        d.setDate(d.getDate() + 1);
        where.birthDate.lte = d;
      }
    }

    const limit = Math.min(input.limit || 30, 100);

    if (input.semAgendamentoHaDias) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.semAgendamentoHaDias);

      const all = await prisma.patient.findMany({
        where,
        include: { appointments: { orderBy: { startsAt: "desc" }, take: 1 } },
        take: 300,
        orderBy: { name: "asc" },
      });

      const filtered = all.filter((p) => {
        const last = p.appointments[0];
        return !last || new Date(last.startsAt) < cutoff;
      });

      const today = new Date();
      return {
        total: filtered.length,
        pacientes: filtered.slice(0, limit).map((p) => ({
          nome: p.name,
          idade: p.birthDate
            ? Math.floor((today - new Date(p.birthDate)) / (365.25 * 24 * 3600 * 1000))
            : null,
          cidade: p.city || null,
          telefone: p.phone || null,
          ultimoAgendamento: p.appointments[0]
            ? new Date(p.appointments[0].startsAt).toLocaleDateString("pt-BR")
            : "nunca",
        })),
      };
    }

    const patients = await prisma.patient.findMany({
      where,
      take: limit,
      orderBy: { name: "asc" },
    });

    const today = new Date();
    return {
      total: patients.length,
      pacientes: patients.map((p) => ({
        nome: p.name,
        idade: p.birthDate
          ? Math.floor((today - new Date(p.birthDate)) / (365.25 * 24 * 3600 * 1000))
          : null,
        cidade: p.city || null,
        telefone: p.phone || null,
      })),
    };
  }

  if (name === "resumo_financeiro") {
    const where = { userId };
    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) where.createdAt.gte = new Date(input.from);
      if (input.to) {
        const to = new Date(input.to);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const txs = await prisma.transaction.findMany({ where });

    const receita = txs.filter((t) => t.type === "receita" && t.status === "pago");
    const despesa = txs.filter((t) => t.type === "despesa" && t.status === "pago");
    const pendente = txs.filter((t) => t.status === "pendente");

    const sum = (arr) => arr.reduce((s, t) => s + Number(t.amount), 0);

    return {
      receitaTotal: sum(receita),
      despesaTotal: sum(despesa),
      lucroLiquido: sum(receita) - sum(despesa),
      pendentesReceita: sum(pendente.filter((t) => t.type === "receita")),
      pendentesDespesa: sum(pendente.filter((t) => t.type === "despesa")),
      ticketMedio: receita.length > 0 ? sum(receita) / receita.length : 0,
      quantidadeReceitas: receita.length,
      quantidadeDespesas: despesa.length,
    };
  }

  if (name === "estatisticas_agenda") {
    const where = { userId };
    if (input.from || input.to) {
      where.startsAt = {};
      if (input.from) where.startsAt.gte = new Date(input.from);
      if (input.to) {
        const to = new Date(input.to);
        to.setHours(23, 59, 59, 999);
        where.startsAt.lte = to;
      }
    }

    const appointments = await prisma.appointment.findMany({ where });

    const byStatus = {};
    const byProcedure = {};
    const byProfessional = {};

    for (const a of appointments) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.procedureType) byProcedure[a.procedureType] = (byProcedure[a.procedureType] || 0) + 1;
      if (a.professional) byProfessional[a.professional] = (byProfessional[a.professional] || 0) + 1;
    }

    return {
      total: appointments.length,
      porStatus: byStatus,
      topProcedimentos: Object.entries(byProcedure)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, count]) => ({ nome, count })),
      topProfissionais: Object.entries(byProfessional)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, count]) => ({ nome, count })),
    };
  }

  throw new Error(`Ferramenta desconhecida: ${name}`);
}

export async function chatReports(userId, messages) {
  const today = new Date().toLocaleDateString("pt-BR");
  const systemPrompt = {
    type: "text",
    text: `Você é um assistente analítico do Iasoclin. Responda perguntas sobre os dados da clínica usando as ferramentas disponíveis.
Sempre busque os dados antes de responder — nunca invente informações ou números.
Responda em português brasileiro de forma concisa e clara.
Ao listar pacientes, mostre nome, idade e cidade quando disponível.
Data de hoje: ${today}.`,
    cache_control: { type: "ephemeral" },
  };

  const allMessages = [...messages];

  for (let iteration = 0; iteration < 6; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [systemPrompt],
      tools: REPORT_TOOLS,
      messages: allMessages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text");
      return text?.text ?? "Não consegui gerar uma resposta.";
    }

    if (response.stop_reason === "tool_use") {
      allMessages.push({ role: "assistant", content: response.content });

      const results = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const result = await executeTool(block.name, block.input, userId);
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Erro: ${e.message}`, is_error: true });
        }
      }

      allMessages.push({ role: "user", content: results });
    } else {
      break;
    }
  }

  return "Não consegui processar sua pergunta. Tente novamente.";
}

export async function chatHelp(messages) {
  const systemPrompt = {
    type: "text",
    text: `Você é o assistente de suporte do Iasoclin, um sistema de gestão para clínicas de harmonização facial e estética.
Responda apenas perguntas sobre como usar o sistema. Seja objetivo, amigável e use linguagem simples.

Módulos disponíveis no sistema:
- Dashboard: visão geral do dia, agenda de hoje, atalhos rápidos
- Pacientes: cadastro, busca, prontuário completo com evoluções, timeline, sessões, mapa de procedimentos
- Agenda: calendário com drag-and-drop, agendamentos por profissional, filtros
- Procedimentos: cadastro com duração, preço, materiais vinculados — a descrição vira template na evolução
- Produtos: controle de estoque com movimentações de entrada/saída
- Financeiro: receitas, despesas, fluxo de caixa mensal
- Clube: planos de assinatura para pacientes recorrentes
- Evoluções: registro clínico por paciente, com geração automática via IA
- Mapa de procedimentos: marcação visual de pontos de aplicação no rosto do paciente

Se a pergunta não for sobre o sistema, responda: "Posso ajudar apenas com dúvidas sobre o Iasoclin."`,
    cache_control: { type: "ephemeral" },
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [systemPrompt],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content[0].text;
}

export async function generateDailyInsight(userId) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAppts, monthAppts, totalPatients, recentEvolutions] = await Promise.all([
    prisma.appointment.count({
      where: { userId, startsAt: { gte: todayStart, lte: todayEnd }, status: { not: "CANCELED" } },
    }),
    prisma.appointment.count({
      where: { userId, startsAt: { gte: monthStart }, status: { not: "CANCELED" } },
    }),
    prisma.patient.count({ where: { userId, isActive: true } }),
    prisma.evolution.findMany({
      where: { createdById: userId, createdAt: { gte: monthStart } },
      select: { procedure: true },
      take: 50,
    }),
  ]);

  const procCount = recentEvolutions.reduce((acc, e) => {
    if (e.procedure) acc[e.procedure] = (acc[e.procedure] || 0) + 1;
    return acc;
  }, {});
  const topProc = Object.entries(procCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });

  const prompt = `Você é um assistente motivacional para uma clínica de estética médica.
Gere UMA frase curta (máximo 18 palavras) personalizada para o profissional de saúde iniciar o dia.
A frase deve ser inspiradora e elegante, em português brasileiro.
Não use aspas. Não use emojis. Não comece com "Hoje".

Contexto:
- Dia: ${weekday}
- Agendamentos hoje: ${todayAppts}
- Agendamentos este mês: ${monthAppts}
- Pacientes ativos: ${totalPatients}
${topProc ? `- Procedimento em destaque: ${topProc}` : ""}

Retorne apenas a frase, sem mais nada.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 80,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim().replace(/^["']|["']$/g, "");
}
