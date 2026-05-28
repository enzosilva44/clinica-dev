import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../config/prisma.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

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
    const text = response.content[0].text.trim();
    const json = text.startsWith("[") ? text : text.slice(text.indexOf("["));
    return JSON.parse(json);
  } catch {
    return [];
  }
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
