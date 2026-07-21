import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { prisma } from "../../config/prisma.js";
import { seedDefaultProcedures } from "../../shared/defaultProcedures.js";
import { seedDefaultFolders } from "../../shared/defaultFolders.js";
import { saveFile } from "../../providers/storage/index.js";
import { buildStorageKey } from "../../providers/storage/storageKey.js";
import { solidPng, DEMO_PORTFOLIO_COLORS } from "./demoImage.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function buildToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan ?? "solo",
    nickname: user.nickname,
    gender: user.gender,
    phone: user.phone,
    clinicName: user.clinicName,
    featureOverrides: user.featureOverrides ?? {},
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    mustChangePassword: user.mustChangePassword ?? false,
    demoExpiresAt: user.demoExpiresAt ?? null,
  };
}

export async function register(req, res) {
  const {
    name, email, password,
    nickname, gender, clinicName, specialty, professionalId,
    personType, phone, cpf, cnpj, rg, birthDate,
    street, addressNumber, complement, neighborhood, city, state, zipCode,
    plan,
  } = req.body;

  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) return res.status(400).json({ error: "E-mail já cadastrado." });

  const passwordHash = await bcrypt.hash(password, 8);

  const user = await prisma.user.create({
    data: {
      name, email, password: passwordHash,
      nickname:        nickname        || null,
      gender:          gender          || null,
      clinicName:      clinicName      || null,
      specialty:       specialty       || null,
      professionalId:  professionalId  || null,
      personType:      personType      || "pf",
      phone:           phone           || null,
      cpf:             cpf             || null,
      cnpj:            cnpj            || null,
      rg:              rg              || null,
      birthDate:       birthDate ? new Date(birthDate) : null,
      street:        street        || null,
      addressNumber: addressNumber || null,
      complement:    complement    || null,
      neighborhood:  neighborhood  || null,
      city:          city          || null,
      state:         state         || null,
      zipCode:       zipCode       || null,
      plan:          plan          || "solo",
    },
  });

  // Novo usuário nasce com o catálogo de procedimentos padrão.
  await seedDefaultProcedures(prisma, user.id).catch((e) =>
    console.error("[seedDefaultProcedures] register:", e.message)
  );
  await seedDefaultFolders(prisma, user.id).catch((e) =>
    console.error("[seedDefaultFolders] register:", e.message)
  );

  const token = buildToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
}

// TTL da conta demo: expira 48h após a criação. O cron de limpeza
// (automation.cron.js) apaga contas demo vencidas.
const DEMO_TTL_HOURS = 48;

// Dados genéricos para popular a demo com volume realista.
const DEMO_NOMES = [
  "Maria Silva", "Ana Beatriz Costa", "Juliana Ferreira", "Camila Rodrigues",
  "Fernanda Almeida", "Patrícia Santos", "Renata Oliveira", "Larissa Souza",
  "Bruna Carvalho", "Gabriela Lima",
];
const DEMO_PROCEDIMENTOS = [
  { nome: "Limpeza de pele", preco: 150 },
  { nome: "Preenchimento labial", preco: 900 },
  { nome: "Toxina botulínica (testa)", preco: 800 },
  { nome: "Peeling químico", preco: 300 },
  { nome: "Microagulhamento", preco: 450 },
  { nome: "Avaliação facial", preco: 0 },
  { nome: "Bioestimulador de colágeno", preco: 1500 },
];
const DEMO_PRODUTOS = [
  { name: "Ácido Hialurônico 1ml", category: "insumos", supplier: "Galderma", unitPrice: 350, stock: 8, minStock: 3, unit: "seringa" },
  { name: "Toxina Botulínica 100U", category: "insumos", supplier: "Allergan", unitPrice: 900, stock: 4, minStock: 2, unit: "frasco" },
  { name: "Agulha 30G", category: "descartaveis", supplier: "Mercado Livre", unitPrice: 2, stock: 120, minStock: 50, unit: "un" },
  { name: "Luva nitrílica (cx)", category: "descartaveis", supplier: "Cremer", unitPrice: 45, stock: 15, minStock: 5, unit: "caixa" },
  { name: "Máscara facial calmante", category: "insumos", supplier: "Fornecedor Local", unitPrice: 18, stock: 30, minStock: 10, unit: "un" },
  { name: "Álcool 70% 1L", category: "descartaveis", supplier: "Farmácia", unitPrice: 12, stock: 2, minStock: 4, unit: "frasco" },
];
const pick = (arr, i) => arr[i % arr.length];

// Popula a conta demo com VOLUME realista (vários registros por módulo) para a
// pessoa ver o sistema como uma clínica em uso: dashboard, agenda, financeiro e
// relatórios com dados. Cada bloco é isolado (um erro não derruba os demais).
// Portfólio fica de fora por exigir upload real de fotos antes/depois.
async function seedDemoData(userId) {
  const safe = (label, fn) => fn().catch((e) => console.error(`[seedDemoData] ${label}:`, e.message));
  const now = new Date();
  const atHour = (base, h) => { const d = new Date(base); d.setHours(h, 0, 0, 0); return d; };

  // ── Pacientes (10) ──
  const patients = [];
  for (let i = 0; i < DEMO_NOMES.length; i++) {
    const nome = DEMO_NOMES[i];
    const slug = nome.toLowerCase().replace(/[^a-z]/g, ".");
    const p = await prisma.patient.create({
      data: {
        userId, name: nome,
        phone: `(16) 9${String(90000000 + i * 111111).slice(0, 8)}`,
        email: `${slug}@exemplo.com`,
        alertLevel: i % 5 === 0 ? "high" : "none",
        observations: i % 3 === 0 ? "Pele sensível — evitar ativos abrasivos." : null,
      },
    }).catch((e) => { console.error("[seedDemoData] patient:", e.message); return null; });
    if (p) patients.push(p);
  }
  if (patients.length === 0) return;

  // ── Agendamentos (espalhados: passados concluídos + futuros agendados) ──
  await safe("appointments", async () => {
    const rows = [];
    for (let i = 0; i < 14; i++) {
      const pac = pick(patients, i);
      const proc = pick(DEMO_PROCEDIMENTOS, i);
      const dayOffset = i - 7; // -7 a +6 dias
      const base = new Date(now); base.setDate(base.getDate() + dayOffset);
      const startsAt = atHour(base, 9 + (i % 8));
      const endsAt = new Date(startsAt); endsAt.setHours(startsAt.getHours() + 1);
      const status = dayOffset < 0 ? "COMPLETED" : dayOffset === 0 ? "CONFIRMED" : "SCHEDULED";
      rows.push({
        userId, patientId: pac.id,
        title: `${proc.nome} — ${pac.name.split(" ")[0]}`,
        startsAt, endsAt, category: "consulta", status,
      });
    }
    await prisma.appointment.createMany({ data: rows });
  });

  // ── Evoluções (para os primeiros pacientes) ──
  await safe("evolutions", async () => {
    for (let i = 0; i < 5; i++) {
      const pac = pick(patients, i);
      const proc = pick(DEMO_PROCEDIMENTOS, i);
      const d = new Date(now); d.setDate(d.getDate() - (i + 1) * 3);
      await prisma.evolution.create({
        data: {
          patientId: pac.id, createdById: userId,
          name: `Sessão — ${proc.nome}`,
          content: `Paciente compareceu para ${proc.nome.toLowerCase()}. Procedimento realizado sem intercorrências. Orientada quanto aos cuidados pós.`,
          date: d,
        },
      });
    }
  });

  // ── Produtos / estoque (6) ──
  await safe("products", () => prisma.product.createMany({ data: DEMO_PRODUTOS.map((p) => ({ userId, ...p })) }));

  // ── Transações financeiras do mês (receitas pagas + despesas + a receber) ──
  await safe("transactions", async () => {
    for (let i = 0; i < 12; i++) {
      const pac = pick(patients, i);
      const proc = pick(DEMO_PROCEDIMENTOS.filter((x) => x.preco > 0), i);
      const d = new Date(now); d.setDate(d.getDate() - (14 - i));
      const pago = i % 4 !== 0;
      await prisma.transaction.create({
        data: {
          userId, patientId: pac.id,
          type: "receita", status: pago ? "pago" : "pendente",
          description: `${proc.nome} — ${pac.name.split(" ")[0]}`,
          amount: proc.preco, paymentMethod: pick(["pix", "credit_card", "dinheiro"], i),
          category: "procedimento", paidAt: pago ? d : null, dueDate: d,
        },
      });
    }
    // despesas fixas
    await prisma.transaction.createMany({
      data: [
        { userId, type: "despesa", status: "pago", description: "Aluguel da sala", amount: 1800, category: "fixo", paidAt: now },
        { userId, type: "despesa", status: "pago", description: "Compra de insumos", amount: 1250, category: "estoque", paidAt: now },
        { userId, type: "despesa", status: "pendente", description: "Energia elétrica", amount: 320, category: "fixo", dueDate: now },
      ],
    });
  });

  // ── Orçamentos (3, status variados) ──
  await safe("budgets", async () => {
    const statuses = ["rascunho", "aprovado", "concluido"];
    for (let i = 0; i < 3; i++) {
      const pac = pick(patients, i);
      const proc = pick(DEMO_PROCEDIMENTOS.filter((x) => x.preco > 0), i + 1);
      await prisma.budget.create({
        data: {
          userId, patientId: pac.id,
          title: `Orçamento — ${proc.nome}`,
          subtotal: proc.preco, total: proc.preco, status: statuses[i],
          items: { create: [{ procedureName: proc.nome, quantity: 1, unitPrice: proc.preco, total: proc.preco }] },
        },
      });
    }
  });

  // ── Protocolos (2) ──
  await safe("protocols", () => prisma.protocol.createMany({
    data: [
      { userId, name: "Protocolo de rejuvenescimento", description: "Pacote com 4 sessões sequenciais.", useFixedPrice: true, fixedPrice: 1200 },
      { userId, name: "Protocolo skinbooster", description: "Hidratação profunda em 3 sessões.", useFixedPrice: true, fixedPrice: 1500 },
    ],
  }));

  // ── Clube: 2 planos + membros ──
  await safe("club", async () => {
    const mensal = await prisma.clubPlan.create({
      data: {
        userId, name: "Clube Beleza — Mensal", description: "Assinatura mensal com benefícios.",
        price: 199, billingCycle: "mensal",
        items: { create: [{ procedureName: "Limpeza de pele", quantity: 1 }, { procedureName: "Peeling químico", quantity: 1 }] },
      },
    });
    const anual = await prisma.clubPlan.create({
      data: {
        userId, name: "Clube Beleza — Anual", description: "Plano anual com desconto.",
        price: 1990, billingCycle: "anual",
        items: { create: [{ procedureName: "Limpeza de pele", quantity: 12 }] },
      },
    });
    for (let i = 0; i < 4; i++) {
      await prisma.clubMember.create({
        data: { userId, patientId: pick(patients, i).id, planId: i % 2 ? anual.id : mensal.id, startDate: now, status: "ativo" },
      });
    }
  });

  // ── Modelo de anamnese ──
  await safe("anamnesis", () => prisma.anamnesisTemplate.create({
    data: {
      userId, name: "Anamnese facial (exemplo)",
      questions: [
        { label: "Possui alguma alergia?", type: "text" },
        { label: "Já realizou procedimentos estéticos antes?", type: "boolean" },
        { label: "Está gestante ou amamentando?", type: "boolean" },
        { label: "Faz uso de algum medicamento contínuo?", type: "text" },
      ],
    },
  }));

  // ── Mapas de procedimentos (3) ──
  await safe("procedureMaps", async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.procedureMap.create({
        data: {
          userId, patientId: pick(patients, i).id,
          title: `Mapa facial — ${pick(patients, i).name.split(" ")[0]}`,
          clinicalNotes: "Pontos de aplicação registrados na sessão.",
        },
      });
    }
  });

  // ── Portfólio: casos antes/depois com fotos CHUMBADAS (geradas em código) ──
  await safe("portfolio", async () => {
    const casos = [
      { proc: "Preenchimento labial", caption: "Resultado natural após 1 sessão." },
      { proc: "Toxina botulínica", caption: "Suavização de linhas de expressão." },
      { proc: "Limpeza de pele", caption: "Pele renovada e uniforme." },
    ];
    for (let i = 0; i < casos.length; i++) {
      const pac = pick(patients, i);
      const colors = DEMO_PORTFOLIO_COLORS[i % DEMO_PORTFOLIO_COLORS.length];

      // salva os 2 arquivos e cria os PatientPhoto correspondentes
      const makePhoto = async (label, rgb) => {
        const filePath = buildStorageKey({
          type: "photo", clinicId: userId, patientId: pac.id,
          originalName: `${label}.png`, defaultExt: ".png",
        });
        await saveFile(solidPng(600, 600, rgb), filePath, "image/png");
        return prisma.patientPhoto.create({
          data: {
            fileName: `${label}.png`, filePath, mimeType: "image/png",
            patientId: pac.id, userId,
          },
        });
      };

      const before = await makePhoto("antes", colors.before);
      const after = await makePhoto("depois", colors.after);

      await prisma.portfolioCase.create({
        data: {
          userId, patientId: pac.id,
          title: casos[i].proc, procedureName: casos[i].proc, caption: casos[i].caption,
          featured: i === 0,
          beforePhotoId: before.id, afterPhotoId: after.id,
        },
      });
    }
  });
}

// POST /auth/demo — cria uma conta demo temporária (plano "demo", features de
// Solo), loga automaticamente e semeia dados de exemplo. Origem do lead
// (canal de aquisição / UTM) é gravada para o CRM.
export async function createDemo(req, res) {
  const { name, phone, email, acquisitionChannel, utm } = req.body || {};

  // Nome e telefone são obrigatórios para captar o lead; e-mail é opcional.
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
  }

  try {
    const expiresAt = new Date(Date.now() + DEMO_TTL_HOURS * 60 * 60 * 1000);
    const stamp = Date.now().toString(36);
    // Senha aleatória: a demo entra por token, não por login manual.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 8);
    const channel = acquisitionChannel || utm?.source || null;
    const cleanName = name.trim();

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        // e-mail de LOGIN é sempre único; o e-mail real (se houver) fica no Lead
        email: `demo+${stamp}@demo.iasoclin`,
        password: passwordHash,
        clinicName: cleanName,
        phone: phone.trim(),
        plan: "demo",
        demoExpiresAt: expiresAt,
        leadSource: "self-service",
        acquisitionChannel: channel,
      },
    });

    // Cria o card no CRM já na demo (pipeline comercial, status "demo").
    await prisma.lead.create({
      data: {
        name: cleanName,
        phone: phone.trim(),
        email: email?.trim() || null,
        clinicName: cleanName,
        source: "self-service",
        status: "demo",
        notes: channel ? `Origem: ${channel}` : null,
      },
    }).catch((e) => console.error("[createDemo] lead:", e.message));

    await seedDefaultProcedures(prisma, user.id).catch((e) =>
      console.error("[seedDefaultProcedures] demo:", e.message)
    );
    await seedDefaultFolders(prisma, user.id).catch((e) =>
      console.error("[seedDefaultFolders] demo:", e.message)
    );
    await seedDemoData(user.id).catch((e) =>
      console.error("[seedDemoData] demo:", e.message)
    );

    const token = buildToken(user);
    return res.status(201).json({
      token,
      user: publicUser(user),
      demoExpiresAt: expiresAt,
    });
  } catch (e) {
    console.error("[createDemo]", e.message);
    return res.status(400).json({ error: "Não foi possível abrir a demonstração." });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return res.status(400).json({
      error: "Usuário ou senha inválidos",
    });
  }

  const passwordMatch = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatch) {
    return res.status(400).json({
      error: "Usuário ou senha inválidos",
    });
  }

  // Track login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
  });

  const token = buildToken(user);
  return res.json({ token, user: publicUser(user) });
}

export async function googleLogin(req, res) {
  try {
    const { credential } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        error: "GOOGLE_CLIENT_ID não configurado",
      });
    }

    if (!credential) {
      return res.status(400).json({
        error: "Credential do Google obrigatória",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name || email;
    const avatarUrl = payload?.picture || null;

    if (!googleId || !email) {
      return res.status(400).json({
        error: "Conta Google sem e-mail válido",
      });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
        ],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId,
          avatarUrl,
          authProvider: user.authProvider === "password" ? "password_google" : user.authProvider,
          lastLoginAt: new Date(),
          loginCount: { increment: 1 },
        },
      });
    } else {
      const randomPassword = await bcrypt.hash(
        `${googleId}-${crypto.randomUUID()}`,
        8
      );

      user = await prisma.user.create({
        data: {
          name,
          email,
          password: randomPassword,
          googleId,
          avatarUrl,
          authProvider: "google",
        },
      });
      // Novo usuário (via Google) também recebe o catálogo padrão.
      await seedDefaultProcedures(prisma, user.id).catch((e) =>
        console.error("[seedDefaultProcedures] google:", e.message)
      );
      await seedDefaultFolders(prisma, user.id).catch((e) =>
        console.error("[seedDefaultFolders] google:", e.message)
      );
    }

    const token = buildToken(user);

    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      error: "Login com Google inválido",
    });
  }
}
