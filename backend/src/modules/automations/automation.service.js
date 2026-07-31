import { prisma } from "../../config/prisma.js";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "../whatsapp/whatsapp.provider.js";
import { checkQuota, consumeQuota } from "../billing/quota.service.js";
import { getFeatures } from "../../config/features.js";

// {{clinica}} = apresentação da clínica (ex.: "do consultório da Dra. Fernanda"),
// injetada automaticamente em logAndSend. Como o número é único/compartilhado,
// TODA mensagem abre identificando de quem é.
const DEFAULT_TEMPLATES = {
  birthday: {
    name: "Feliz aniversário",
    body: "Olá {{nome}}! 🎂 Aqui é {{clinica}}. Passando pra desejar um feliz aniversário!\n\nQue seu dia seja especial. 🎉",
    metaTemplateName: "aniversario_iaso",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "clinica"],
  },
  welcome: {
    name: "Boas-vindas",
    body: "Olá {{nome}}! 😊 Aqui é {{clinica}}. Seja muito bem-vindo(a)!\n\nEstamos aqui para cuidar de você. Qualquer dúvida, é só chamar.",
    metaTemplateName: "boas_vindas_iaso",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "clinica"],
  },
  // ATENÇÃO à inversão: o tipo "confirmation" é o AVISO DE AGENDAMENTO (sai na
  // hora em que a consulta é marcada) e usa o template lembrete_consulta_iaso.
  // O tipo "reminder" é o PEDIDO DE CONFIRMAÇÃO (véspera) e usa o
  // confirmacao_consulta_iaso, que é quem tem os botões de resposta.
  //
  // Por quê: pedir confirmação com 30 dias de antecedência não serve para nada
  // — a resposta perde validade antes da data. Confirmar na véspera é o que
  // permite liberar o horário a tempo. Os botões precisam chegar nesse momento.
  //
  // Os NOMES dos templates na Meta ficaram trocados em relação ao papel que
  // exercem. Trocar o texto de um template aprovado exige nova submissão e
  // aprovação da Meta, então a inversão foi feita só no gatilho. Ao resubmeter,
  // renomear/reescrever os corpos e desfazer este cruzamento.
  confirmation: {
    name: "Aviso de agendamento",
    body: "Olá {{nome}}! Aqui é {{clinica}}. ✅ Seu agendamento está marcado para {{data}} às {{hora}}. Aguardamos você! Caso precise reagendar, entre em contato.",
    metaTemplateName: "lembrete_consulta_iaso",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "clinica", "data", "hora"],
  },
  reminder: {
    name: "Pedido de confirmação (véspera)",
    body: "Olá {{nome}}! 🔔 Aqui é {{clinica}}. Sua consulta é em {{data}} às {{hora}}. Pode confirmar pra gente?",
    metaTemplateName: "confirmacao_consulta_iaso",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "clinica", "data", "hora"],
  },
  payment_link: {
    name: "Link de pagamento",
    // Template aprovado na Meta: aviso_fatura_iaso (Utility). O corpo tem 4
    // variáveis e o LINK NÃO é uma delas — vai no botão de URL dinâmica
    // ("https://www.asaas.com/i/{{1}}"), que recebe só o trecho final da URL.
    // Por isso metaVariables não inclui "link"; quem envia passa urlButtonParam.
    body: "Olá {{nome}}! Aqui é {{clinica}}. Passando pra avisar sobre um valor em aberto.\n\n💰 Valor: {{valor}}\n📅 Vencimento: {{vencimento}}\n\nVocê pode pagar pelo link abaixo. Se já pagou, pode ignorar — pode levar até 1 dia útil pra compensar. Qualquer dúvida, é só chamar.",
    metaTemplateName: "aviso_fatura_iaso",
    metaLanguage: "pt_BR",
    metaVariables: ["nome", "clinica", "valor", "vencimento"],
  },
};

function interpolate(body, vars) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Como a clínica se apresenta ao paciente no WhatsApp.
// Modelo atual: 1 número único (o da plataforma) envia por TODAS as clínicas,
// então CADA mensagem precisa dizer de quem é. Formato: "do consultório da Dra. X".
// Fonte única — usada tanto nas mensagens de texto quanto como variável de template.
// Prioridade do nome: nickname (como a pessoa quer ser chamada) > name (dono) > clinicName.
export function apresentacaoClinica(user = {}) {
  const nome = (user.nickname || user.name || user.clinicName || "").trim();
  if (!nome) return "do seu consultório"; // fallback sem vazar vazio

  const feminino = user.gender === "female" || user.gender === "F";
  // Título profissional só quando temos o nome de uma PESSOA (não o nome fantasia da clínica).
  const ehPessoa = Boolean(user.nickname || user.name);
  const titulo = ehPessoa ? (feminino ? "Dra. " : "Dr. ") : "";

  // "consultório" é masculino → sempre "do consultório". O gênero da pessoa
  // muda só o título (Dr./Dra.), nunca o artigo.
  return `do consultório ${titulo}${nome}`;
}

export async function ensureDefaultTemplates(userId) {
  const existing = await prisma.automationTemplate.findMany({ where: { userId } });
  const existingByType = new Map(existing.map((t) => [t.type, t]));
  for (const [type, data] of Object.entries(DEFAULT_TEMPLATES)) {
    const metaFields = {
      metaTemplateName: data.metaTemplateName ?? null,
      metaLanguage: data.metaLanguage ?? "pt_BR",
      metaVariables: data.metaVariables ?? [],
    };
    const current = existingByType.get(type);
    if (!current) {
      await prisma.automationTemplate.create({
        data: { type, name: data.name, body: data.body, isActive: true, userId, ...metaFields },
      });
    } else if (data.metaTemplateName && current.metaTemplateName !== data.metaTemplateName) {
      // Retrofit: alinha o mapeamento Meta com o DEFAULT atual. Cobre tanto quem
      // nunca teve mapeamento quanto quem ficou com um nome que não existe mais
      // na Meta (caso do antigo "link_pagamento", que nunca chegou a ser criado
      // lá e fazia todo envio de cobrança falhar).
      await prisma.automationTemplate.update({
        where: { id: current.id },
        data: metaFields,
      });
    }
  }
}

export async function getActiveTemplate(userId, type) {
  const tpl = await prisma.automationTemplate.findFirst({
    where: { userId, type, isActive: true },
  });
  if (!tpl) return null;

  // Retrofit no caminho de LEITURA. ensureDefaultTemplates() só roda quando
  // alguém abre a tela de Automações, mas os disparos (cron de aniversário,
  // boas-vindas no cadastro) não passam por lá — uma clínica que nunca abriu a
  // tela ficaria com metaTemplateName nulo e cairia em texto livre, que a Meta
  // só entrega dentro da janela de 24h. Como aniversário/boas-vindas são
  // mensagens que NÓS iniciamos, quase nunca há janela: falhavam em silêncio.
  const def = DEFAULT_TEMPLATES[type];
  if (def?.metaTemplateName && tpl.metaTemplateName !== def.metaTemplateName) {
    return prisma.automationTemplate.update({
      where: { id: tpl.id },
      data: {
        metaTemplateName: def.metaTemplateName,
        metaLanguage: def.metaLanguage ?? "pt_BR",
        metaVariables: def.metaVariables ?? [],
        // O rótulo acompanha: confirmation/reminder trocaram de papel, e um
        // nome antigo ("Confirmação de agendamento" no que hoje é o aviso)
        // faria a clínica editar o campo errado. O corpo NÃO é sobrescrito —
        // pode ter sido personalizado pela clínica.
        name: def.name,
      },
    });
  }
  return tpl;
}

export { interpolate };

async function logAndSend({ userId, patientId, patientName, phone, type, message, scheduledFor, templateId, tpl, vars }) {
  if (!phone) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      whatsappPhoneNumberId: true, whatsappAccessToken: true,
      name: true, nickname: true, clinicName: true, gender: true,
      plan: true, featureOverrides: true, role: true,
    },
  });

  // Feature "whatsapp" desligada no admin = nenhuma mensagem sai, ponto.
  // A checagem vive AQUI porque requireFeature() protege só as rotas HTTP: os
  // crons (aniversário/lembrete) e os gatilhos internos (boas-vindas no
  // cadastro, confirmação ao agendar) não passam por middleware nenhum e
  // disparavam para qualquer clínica com template ativo, mesmo desabilitada.
  // logAndSend é o gargalo único de TODAS as automações — cobre todos os
  // caminhos de uma vez. Plano desconhecido cai no default de getFeatures()
  // (solo, whatsapp: false): na dúvida, mudo.
  const features = { ...getFeatures(user?.plan), ...(user?.featureOverrides ?? {}) };
  if (!features.whatsapp) {
    await prisma.automationLog.create({
      data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "skipped", error: "feature_disabled" },
    });
    return;
  }

  // Modelo número-único: o número da plataforma envia por todas as clínicas.
  // Se a clínica conectou o próprio WhatsApp, usa o dela; senão, cai no da plataforma.
  const config = {
    phoneNumberId: user?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken:   user?.whatsappAccessToken   || process.env.WHATSAPP_ACCESS_TOKEN,
  };

  // Toda mensagem precisa identificar de qual clínica é (número compartilhado).
  // Injeta {{clinica}} nas variáveis; templates e corpos usam essa variável.
  const clinica = apresentacaoClinica(user);
  vars = { ...(vars || {}), clinica };
  message = interpolate(message, { clinica });

  if (!config.phoneNumberId || !config.accessToken) {
    await prisma.automationLog.create({
      data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "skipped" },
    });
    return;
  }

  // Cota de WhatsApp esgotada: NÃO quebra o lote de automações (podem rodar em loop),
  // só pula este envio e registra como skipped. A gestão segue funcionando.
  const quota = await checkQuota(userId, "whatsapp");
  if (!quota.ok) {
    await prisma.automationLog.create({
      data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "skipped", error: "quota_exceeded" },
    });
    return;
  }

  const log = await prisma.automationLog.create({
    data: { userId, patientId, patientName, phone, type, message, scheduledFor, templateId, status: "pending" },
  });
  try {
    // Envio proativo (fora da janela de 24h) exige Message Template aprovado na Meta.
    // Se o template tem metaTemplateName, envia via template; senão, texto livre (janela/teste).
    if (tpl?.metaTemplateName) {
      const params = (tpl.metaVariables || []).map((key) => vars?.[key] ?? "");
      await sendWhatsAppTemplate(phone, tpl.metaTemplateName, params, {
        ...config,
        language: tpl.metaLanguage || "pt_BR",
      });
    } else {
      await sendWhatsAppMessage(phone, message, config);
    }
    // Debita 1 mensagem só após o envio confirmado pela Meta.
    await consumeQuota(userId, "whatsapp", 1, { type, templateId: templateId ?? null });
    await prisma.automationLog.update({
      where: { id: log.id },
      data: { status: "sent", sentAt: new Date() },
    });

  } catch (err) {
    await prisma.automationLog.update({
      where: { id: log.id },
      data: { status: "failed", error: err.message },
    });
  }
}

// Called when a new patient is registered
export async function triggerWelcome(userId, patient) {
  const tpl = await getActiveTemplate(userId, "welcome");
  if (!tpl) return;
  const vars = { nome: patient.name.split(" ")[0] };
  const message = interpolate(tpl.body, vars);
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "welcome", message,
    scheduledFor: new Date(), templateId: tpl.id, tpl, vars,
  });
}

// Called when an appointment is created
export async function triggerConfirmation(userId, appointment, patient) {
  const tpl = await getActiveTemplate(userId, "confirmation");
  if (!tpl || !patient?.phone) return;
  const startsAt = new Date(appointment.startsAt);
  const data = startsAt.toLocaleDateString("pt-BR");
  const hora = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const vars = { nome: patient.name.split(" ")[0], data, hora };
  const message = interpolate(tpl.body, vars);
  await logAndSend({
    userId, patientId: patient.id, patientName: patient.name,
    phone: patient.phone, type: "confirmation", message,
    scheduledFor: new Date(), templateId: tpl.id, tpl, vars,
  });
}

// Envio avulso disparado pela tela (ex.: reenviar aviso ao remarcar).
// Existe para que a UI NÃO precise montar texto: passa o tipo e o agendamento,
// e o texto sai do template aprovado. Garante que todo envio manual respeite
// o mesmo caminho das automações — incluindo a checagem de feature.
export async function triggerForAppointment(userId, type, appointmentId) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId },
    include: { patient: true },
  });
  if (!appt?.patient?.phone) return { ok: false, reason: "sem_paciente_ou_telefone" };

  const tpl = await getActiveTemplate(userId, type);
  if (!tpl) return { ok: false, reason: "sem_template" };

  const startsAt = new Date(appt.startsAt);
  const vars = {
    nome: appt.patient.name.split(" ")[0],
    data: startsAt.toLocaleDateString("pt-BR"),
    hora: startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
  await logAndSend({
    userId, patientId: appt.patient.id, patientName: appt.patient.name,
    phone: appt.patient.phone, type, message: interpolate(tpl.body, vars),
    scheduledFor: new Date(), templateId: tpl.id, tpl, vars,
  });
  return { ok: true };
}

// Cron: run daily — send birthday messages
export async function runBirthdayCron() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Find all users and their active birthday template
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id: userId } of users) {
    const tpl = await getActiveTemplate(userId, "birthday");
    if (!tpl) continue;

    const patients = await prisma.patient.findMany({
      where: { userId, isActive: true, birthDate: { not: null } },
      select: { id: true, name: true, phone: true, birthDate: true },
    });

    for (const p of patients) {
      const bd = new Date(p.birthDate);
      if (bd.getMonth() + 1 !== month || bd.getDate() !== day) continue;

      // Avoid duplicate within the same day
      const alreadySent = await prisma.automationLog.findFirst({
        where: {
          userId, patientId: p.id, type: "birthday",
          sentAt: { gte: new Date(now.getFullYear(), month - 1, day) },
          status: "sent",
        },
      });
      if (alreadySent) continue;

      const vars = { nome: p.name.split(" ")[0] };
      const message = interpolate(tpl.body, vars);
      await logAndSend({
        userId, patientId: p.id, patientName: p.name,
        phone: p.phone, type: "birthday", message,
        scheduledFor: now, templateId: tpl.id, tpl, vars,
      });
    }
  }
}

// Cron: run every 30 min — send appointment reminders
export async function runReminderCron() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id: userId } of users) {
    const tpl = await getActiveTemplate(userId, "reminder");
    if (!tpl) continue;
    const hours = tpl.reminderHoursBefore ?? 24;

    const windowStart = new Date(Date.now() + hours * 3600 * 1000 - 15 * 60 * 1000);
    const windowEnd   = new Date(Date.now() + hours * 3600 * 1000 + 15 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        userId,
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { not: "CANCELED" },
      },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    });

    for (const appt of appointments) {
      const alreadySent = await prisma.automationLog.findFirst({
        where: { userId, patientId: appt.patient.id, type: "reminder", templateId: tpl.id,
          scheduledFor: { gte: windowStart, lte: windowEnd }, status: "sent" },
      });
      if (alreadySent) continue;

      const startsAt = new Date(appt.startsAt);
      const data = startsAt.toLocaleDateString("pt-BR");
      const hora = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const vars = { nome: appt.patient.name.split(" ")[0], data, hora };
      const message = interpolate(tpl.body, vars);
      await logAndSend({
        userId, patientId: appt.patient.id, patientName: appt.patient.name,
        phone: appt.patient.phone, type: "reminder", message,
        scheduledFor: new Date(appt.startsAt), templateId: tpl.id, tpl, vars,
      });
    }
  }
}

// CRUD helpers used by controller

export async function listTemplates(userId) {
  return prisma.automationTemplate.findMany({ where: { userId }, orderBy: { type: "asc" } });
}

export async function upsertTemplate(userId, type, data) {
  const existing = await prisma.automationTemplate.findFirst({ where: { userId, type } });
  if (existing) {
    return prisma.automationTemplate.update({ where: { id: existing.id }, data });
  }
  return prisma.automationTemplate.create({ data: { userId, type, ...data } });
}

export async function listLogs(userId, { page = 1, limit = 20, type } = {}) {
  const where = { userId, ...(type ? { type } : {}) };
  const [data, total] = await Promise.all([
    prisma.automationLog.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.automationLog.count({ where }),
  ]);
  return { data, total, totalPages: Math.ceil(total / limit) };
}
