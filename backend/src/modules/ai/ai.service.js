import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../config/prisma.js";
import { consumeQuota } from "../billing/quota.service.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada no backend.");
  }

  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// userId debita 1 ação da cota de IA ANTES da chamada (choke-point único das 8 fns).
// Se a cota estourar, consumeQuota lança QuotaExceededError e nem chega na Anthropic.
// meta opcional identifica a função de origem no log de eventos.
async function createMessage(payload, userId, meta = null) {
  if (userId) {
    await consumeQuota(userId, "ai", 1, meta);
  }
  try {
    return await getClient().messages.create(payload);
  } catch (error) {
    const message = error?.message || "Erro ao chamar a API da Anthropic.";
    throw new Error(`Falha na IA (${MODEL}): ${message}`);
  }
}

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

  const response = await createMessage({
    model: MODEL,
    max_tokens: 600,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Com base no histórico abaixo, gere um resumo clínico conciso (3 a 5 frases) para ser lido rapidamente antes de uma consulta. Inclua: procedimentos realizados, datas relevantes, padrão de resposta e qualquer ponto de atenção. Seja direto e técnico.\n\n${historico}`,
      },
    ],
  }, userId, { fn: "generatePatientSummary", patientId });

  return response.content[0].text;
}

export async function generateEvolutionDraft(data) {
  const { procedureName, dose, region, notes, patientName, userId } = data;

  const response = await createMessage({
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
  }, userId, { fn: "generateEvolutionDraft" });

  return response.content[0].text;
}

// Sugestões de RETORNO CLÍNICO — por REGRA (não IA):
// Para cada paciente ativo, olha o último agendamento CONCLUÍDO cujo procedimento
// exige retorno (Procedure.requiresReturn). A data de retorno = data do atendimento
// + returnDays. Entra na lista quem está VENCIDO ou vence nos próximos 7 dias, e que
// NÃO voltou (sem agendamento posterior à data de retorno). Atrasados primeiro.
export async function generateReturnSuggestions(userId) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 86400000); // próximos 7 dias

  // Procedimentos que exigem retorno, indexados por nome (para casar com procedureType/AppointmentProcedure).
  const procedures = await prisma.procedure.findMany({
    where: { userId, requiresReturn: true },
    select: { name: true, returnDays: true },
  });
  if (procedures.length === 0) return [];
  const returnByName = new Map(procedures.map((p) => [p.name, p.returnDays ?? 0]));

  const patients = await prisma.patient.findMany({
    where: { userId, isActive: true },
    include: {
      appointments: {
        where: { status: { in: ["COMPLETED", "FINISHED"] } },
        orderBy: { startsAt: "desc" },
        include: { procedures: true },
      },
    },
  });

  const results = [];
  for (const p of patients) {
    // Percorre agendamentos concluídos do mais recente pro mais antigo;
    // usa o 1º que tiver um procedimento que exige retorno.
    for (const appt of p.appointments) {
      const names = appt.procedures?.length
        ? appt.procedures.map((x) => x.procedureName)
        : (appt.procedureType ? [appt.procedureType] : []);
      const match = names.find((n) => returnByName.has(n));
      if (!match) continue;

      const returnDays = returnByName.get(match) || 0;
      const returnDate = new Date(appt.startsAt);
      returnDate.setDate(returnDate.getDate() + returnDays);

      // Só interessa se vence até 7 dias (inclui vencidos).
      if (returnDate > windowEnd) break; // retorno ainda distante — nada a sugerir p/ este paciente
      // Já voltou? (algum agendamento posterior à data de retorno)
      const returned = p.appointments.some((a) => new Date(a.startsAt) > returnDate);
      if (returned) break;

      const daysOverdue = Math.floor((now - returnDate) / 86400000);
      results.push({
        name: p.name,
        patientId: p.id,
        procedureName: match,
        lastVisit: appt.startsAt,
        returnDate: returnDate.toISOString(),
        returnDays,
        daysOverdue, // >0 = atrasado, <=0 = vence em breve
        status: daysOverdue > 0 ? "atrasado" : "proximo",
        suggestion:
          daysOverdue > 0
            ? `Retorno de ${match} venceu há ${daysOverdue} dia${daysOverdue > 1 ? "s" : ""} — vale um contato.`
            : `Retorno de ${match} previsto para ${returnDate.toLocaleDateString("pt-BR")}.`,
      });
      break; // um retorno ativo por paciente basta
    }
  }

  // Atrasados primeiro, depois por proximidade da data.
  results.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return results;
}

// ─── GUARDIÃO FINANCEIRO ────────────────────────────────────────────────────

export async function analyzeFinancialHealth(userId) {
  const now = new Date();

  // 1. Transações pendentes com vínculos.
  // Ignora transações que vieram de ORÇAMENTO e ainda estão pendentes: um
  // orçamento é só uma proposta (o paciente pode nunca aceitar), então não
  // deve afetar o score financeiro. Orçamentos que viraram receita (status
  // "pago") continuam contando normalmente pois não entram nesta query.
  const pending = await prisma.transaction.findMany({
    where: { userId, status: "pendente", budgetId: null },
    include: { patient: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  // 2. Duplicidade potencial: mesmo paciente com TX de agendamento E TX de orçamento
  // pendentes. Como transações de orçamento pendentes agora são excluídas da query
  // acima (budgetId: null), este caso deixa de disparar — mantido para o dia em que
  // orçamentos confirmados passarem a gerar transação própria.
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

  const response = await createMessage({
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
  }, userId, { fn: "analyzeFinancialHealth" });

  try {
    return extractJson(response.content[0].text);
  } catch {
    return { alerts: [], score: 50, resumo: "Não foi possível processar a análise." };
  }
}

// ─── GUARDIÃO DE PRODUTOS ───────────────────────────────────────────────────
// Detecta inconsistências no uso de produtos: usados-mas-não-cadastrados,
// baixas duplicadas p/ mesma sessão, estoque <=0 em uso, e produto vencido em uso.
export async function analyzeProductHealth(userId) {
  const now = new Date();

  const [products, maps, stockRequests] = await Promise.all([
    prisma.product.findMany({ where: { userId } }),
    prisma.procedureMap.findMany({
      where: { userId },
      select: { id: true, title: true, date: true, products: true, productName: true, expiryDate: true, patient: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.stockRequest.findMany({
      where: { userId },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Índice de produtos cadastrados por nome normalizado.
  const norm = (s) => (s || "").trim().toLowerCase();
  const byName = new Map();
  for (const p of products) byName.set(norm(p.name), p);

  // Coleta produtos usados nos mapas (lista nova `products` + legado `productName`).
  const usedInMaps = []; // { mapId, mapTitle, patient, date, productName, lotNumber, expiryDate }
  for (const m of maps) {
    const list = Array.isArray(m.products) && m.products.length > 0
      ? m.products
      : (m.productName ? [{ productName: m.productName, expiryDate: m.expiryDate }] : []);
    for (const item of list) {
      if (!item?.productName) continue;
      usedInMaps.push({
        mapId: m.id,
        mapTitle: m.title || "Mapa sem título",
        patient: m.patient?.name ?? "—",
        date: m.date,
        productName: item.productName,
        lotNumber: item.lotNumber ?? null,
        expiryDate: item.expiryDate ?? m.expiryDate ?? null,
      });
    }
  }

  // Regra 1: produto usado em mapa que NÃO está cadastrado no estoque.
  const naoCadastrados = [];
  const seenMissing = new Set();
  for (const u of usedInMaps) {
    if (byName.has(norm(u.productName))) continue;
    const key = norm(u.productName);
    if (seenMissing.has(key)) continue;
    seenMissing.add(key);
    naoCadastrados.push({ produto: u.productName, exemploPaciente: u.patient, exemploMapa: u.mapTitle });
  }

  // Regra 2: baixas (StockRequest tipo saída) duplicadas p/ mesmo produto + mesmo
  // motivo/sessão. Agrupa por productId+reason; 2+ pendentes = suspeita de duplicidade.
  const baixaGroups = {};
  for (const r of stockRequests) {
    const isSaida = (r.type || "").toLowerCase().includes("sa") || (r.type || "").toLowerCase() === "out" || r.quantity < 0 || (r.type || "").toLowerCase().includes("baixa");
    if (!isSaida) continue;
    const key = `${r.productId}::${norm(r.reason)}`;
    (baixaGroups[key] ??= []).push(r);
  }
  const baixasDuplicadas = Object.values(baixaGroups)
    .filter((g) => g.length > 1 && norm(g[0].reason) !== "")
    .map((g) => ({
      produto: g[0].product?.name ?? "—",
      motivoSessao: g[0].reason,
      quantidadeSolicitacoes: g.length,
      total: g.reduce((s, r) => s + Math.abs(Number(r.quantity) || 0), 0),
    }));

  // Regra 3: produto com estoque <=0 que aparece usado em mapa recente (60 dias).
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  const estoqueZeradoEmUso = [];
  const seenZero = new Set();
  for (const u of usedInMaps) {
    if (u.date && new Date(u.date) < sixtyDaysAgo) continue;
    const p = byName.get(norm(u.productName));
    if (!p) continue; // não cadastrado já é a regra 1
    if (p.stock != null && p.stock <= 0 && !seenZero.has(p.id)) {
      seenZero.add(p.id);
      estoqueZeradoEmUso.push({ produto: p.name, estoque: p.stock, exemploPaciente: u.patient });
    }
  }

  // Regra 4: produto usado com validade (lote) já vencida.
  const vencidosEmUso = [];
  for (const u of usedInMaps) {
    if (!u.expiryDate) continue;
    const exp = new Date(u.expiryDate);
    if (isNaN(exp) || exp >= now) continue;
    vencidosEmUso.push({
      produto: u.productName,
      lote: u.lotNumber,
      validade: exp.toLocaleDateString("pt-BR"),
      paciente: u.patient,
      mapa: u.mapTitle,
    });
  }

  const findings = {
    resumo: {
      produtosCadastrados: products.length,
      mapasAnalisados: maps.length,
      naoCadastrados: naoCadastrados.length,
      baixasDuplicadas: baixasDuplicadas.length,
      estoqueZeradoEmUso: estoqueZeradoEmUso.length,
      vencidosEmUso: vencidosEmUso.length,
    },
    naoCadastrados,
    baixasDuplicadas,
    estoqueZeradoEmUso,
    vencidosEmUso,
  };

  const totalProblems =
    naoCadastrados.length + baixasDuplicadas.length + estoqueZeradoEmUso.length + vencidosEmUso.length;

  if (totalProblems === 0) {
    return { alerts: [], score: 100, resumo: "Nenhuma inconsistência detectada no uso de produtos." };
  }

  const response = await createMessage({
    model: MODEL,
    max_tokens: 1500,
    system: [BASE_SYSTEM],
    messages: [
      {
        role: "user",
        content: `Você é o Guardião de Produtos do Iasoclin. Analise os dados abaixo e gere alertas sobre inconsistências no uso de produtos (insumos) da clínica.

Retorne APENAS um JSON com este formato exato (sem markdown, sem explicação):
{
  "score": <número 0-100 indicando consistência do controle de produtos>,
  "resumo": "<frase resumindo o estado geral>",
  "alerts": [
    {
      "severity": "critico" | "alerta" | "info",
      "tipo": "<categoria curta do problema>",
      "titulo": "<título claro>",
      "descricao": "<explicação do problema e seu impacto>",
      "produtos": ["nomes afetados"],
      "acaoSugerida": "<o que fazer para resolver>"
    }
  ]
}

Priorize: crítico = produto vencido em uso ou baixa duplicada na mesma sessão (risco clínico/estoque); alerta = produto usado não cadastrado ou estoque zerado em uso; info = oportunidade de organização.

DADOS:
${JSON.stringify(findings, null, 2)}`,
      },
    ],
  }, userId, { fn: "analyzeProductHealth" });

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
    const response = await createMessage({
      model: MODEL,
      max_tokens: 1024,
      system: [systemPrompt],
      tools: REPORT_TOOLS,
      messages: allMessages,
    }, userId, { fn: "chatReports" });

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

export async function chatHelp(messages, userId) {
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

  const response = await createMessage({
    model: MODEL,
    max_tokens: 400,
    system: [systemPrompt],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  }, userId, { fn: "chatHelp" });

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

  const response = await createMessage({
    model: MODEL,
    max_tokens: 80,
    messages: [{ role: "user", content: prompt }],
  }, userId, { fn: "generateDailyInsight" });

  return response.content[0].text.trim().replace(/^["']|["']$/g, "");
}
