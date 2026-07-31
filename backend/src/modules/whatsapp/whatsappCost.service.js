import { prisma } from "../../config/prisma.js";
import { fetchPricingAnalytics, diaUTC, DIAS_REVISAO } from "./whatsappCost.provider.js";
import { getCotacaoUsdBrl } from "../../providers/cambio/cambio.provider.js";

// Categoria de preço da Meta por tipo de automação nossa. Usado APENAS para
// ratear o custo entre clínicas — a Meta cobra a WABA inteira e não diz de
// quem foi cada mensagem (número único compartilhado).
//
// Marketing custa ~9× Utility por mensagem, então misturar os dois num rateio
// por contagem simples distorceria muito: uma clínica que só manda aniversário
// pareceria tão barata quanto uma que só manda lembrete.
export const CATEGORIA_POR_TIPO = {
  confirmation: "UTILITY",
  reminder:     "UTILITY",
  payment_link: "UTILITY",
  owner_notify: "UTILITY",
  birthday:     "MARKETING",
  welcome:      "MARKETING",
};

// Tudo aqui é USD, a moeda em que a Meta cobra de fato. Não convertemos para
// BRL: a taxa teria de vir de algum lugar (env fixa envelhece em silêncio) e o
// número convertido não bate com a fatura — que ainda passa por spread e IOF do
// cartão. Mostrar o valor real da Meta é mais honesto que uma conversão nossa.

// ─── sincronização (cron) ────────────────────────────────────────────────────

// Intervalo mínimo entre syncs manuais. O cron roda 1×/dia e sozinho nem chega
// perto do rate limit da Graph; quem pode abusar é o botão "Sincronizar agora"
// clicado em sequência. Importa porque o limite é POR APP: estourar aqui
// devolveria erro também no ENVIO de mensagem, que usa o mesmo app.
//
// A trava vive no servidor, não no botão: um debounce no front não protege
// contra chamada direta ao endpoint.
export const SYNC_MIN_INTERVALO_MS = 60_000;

// Quando foi a última sync — derivado do próprio cache (`syncedAt`), não de
// estado em memória, que zeraria a cada restart e não valeria entre instâncias.
export async function ultimaSyncEm() {
  const ultima = await prisma.whatsappCostDaily.findFirst({
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });
  return ultima?.syncedAt ?? null;
}

// Puxa a janela recente da Graph e regrava no cache local.
// Regrava (upsert) em vez de inserir porque a Meta REVISA os números por ~2
// dias: a linha de ontem que você gravou hoje pode mudar amanhã.
//
// `forcar` = chamada do cron, que é confiável e não passa pela trava.
export async function syncWhatsappCost({ dias = DIAS_REVISAO, forcar = false } = {}) {
  if (!forcar) {
    const ultima = await ultimaSyncEm();
    const desde = ultima ? Date.now() - ultima.getTime() : Infinity;
    if (desde < SYNC_MIN_INTERVALO_MS) {
      const faltam = Math.ceil((SYNC_MIN_INTERVALO_MS - desde) / 1000);
      const e = new Error(
        `Sincronizado há instantes. Aguarde ${faltam}s — os números da Meta não mudam nesse intervalo.`
      );
      e.code = "SYNC_MUITO_RECENTE";
      e.retryEmSegundos = faltam;
      throw e;
    }
  }

  const hoje = diaUTC(new Date());
  const since = new Date(hoje.getTime() - dias * 86400000);
  // `until` é exclusivo no fim do dia de hoje — pega o parcial do dia corrente.
  const until = new Date(hoje.getTime() + 86400000);

  const linhas = await fetchPricingAnalytics({ since, until });

  let gravadas = 0;
  for (const l of linhas) {
    await prisma.whatsappCostDaily.upsert({
      where: {
        day_category_pricing_wabaId: {
          day: l.day, category: l.category, pricing: l.pricing, wabaId: l.wabaId,
        },
      },
      create: { ...l, syncedAt: new Date() },
      update: { volume: l.volume, costUsd: l.costUsd, syncedAt: new Date() },
    });
    gravadas++;
  }

  return { ok: true, linhas: gravadas, since, until };
}

// ─── leitura (painel) ────────────────────────────────────────────────────────

// A Meta manda o TIPO de preço, não um "pago sim/não". Os valores observados na
// WABA de produção são REGULAR (cobrada) e FREE_CUSTOMER_SERVICE (resposta
// dentro da janela de 24h, custo zero) — e a lista muda com o tempo, então
// classificar pelo custo é mais robusto que manter um allowlist de nomes.
//
// Guardamos o rótulo cru no banco; a interpretação vive aqui.
export function isPaga(linha) {
  return Number(linha.costUsd) > 0;
}

// Rateio do custo entre clínicas. NÃO é medição: a Meta não informa a clínica
// de origem, então distribuímos o custo real de cada categoria proporcional a
// quantas mensagens daquela categoria cada clínica enviou (AutomationLog).
//
// Limite conhecido: o AutomationLog não cobre 100% dos envios (avisos ao dono
// e respostas automáticas do Conversas passam por fora). Por isso a soma do
// rateio pode ficar abaixo do custo total — a diferença é devolvida como
// `naoAtribuido`, que é honesto e evita inventar precisão que não existe.
async function ratearPorClinica({ since, until, custoPorCategoria }) {
  const logs = await prisma.automationLog.groupBy({
    by: ["userId", "type"],
    where: { status: "sent", sentAt: { gte: since, lt: until } },
    _count: { _all: true },
  });

  // Total de mensagens por categoria, para saber o peso de cada clínica.
  const totalPorCategoria = {};
  for (const l of logs) {
    const cat = CATEGORIA_POR_TIPO[l.type] ?? "UTILITY";
    totalPorCategoria[cat] = (totalPorCategoria[cat] ?? 0) + l._count._all;
  }

  const porUser = new Map();
  for (const l of logs) {
    const cat = CATEGORIA_POR_TIPO[l.type] ?? "UTILITY";
    const qtd = l._count._all;
    const totalCat = totalPorCategoria[cat] || 0;
    // Fatia do custo REAL daquela categoria proporcional ao volume da clínica.
    const custoCat = custoPorCategoria[cat] ?? 0;
    const fatia = totalCat > 0 ? (custoCat * qtd) / totalCat : 0;

    if (!porUser.has(l.userId)) {
      porUser.set(l.userId, { mensagens: 0, custoUsd: 0, porCategoria: {} });
    }
    const acc = porUser.get(l.userId);
    acc.mensagens += qtd;
    acc.custoUsd += fatia;
    acc.porCategoria[cat] = (acc.porCategoria[cat] ?? 0) + qtd;
  }

  if (porUser.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...porUser.keys()] } },
    select: { id: true, name: true, email: true, plan: true },
  });

  return users
    .map((u) => {
      const a = porUser.get(u.id);
      return {
        id: u.id, name: u.name, email: u.email, plan: u.plan,
        mensagens: a.mensagens,
        custoUsd: Number(a.custoUsd.toFixed(4)),
        porCategoria: a.porCategoria,
      };
    })
    .sort((x, y) => y.custoUsd - x.custoUsd);
}

// Resumo completo do painel: totais, série diária, breakdown e rateio.
// `days` = janela retroativa em dias (default 30).
export async function getWhatsappCostSummary({ days = 30 } = {}) {
  const hoje = diaUTC(new Date());
  const since = new Date(hoje.getTime() - (days - 1) * 86400000);
  const until = new Date(hoje.getTime() + 86400000);

  // Banco e câmbio são independentes — em paralelo. O câmbio nunca lança
  // (devolve null quando indisponível), então não precisa de allSettled.
  const [linhas, cambio] = await Promise.all([
    prisma.whatsappCostDaily.findMany({
      where: { day: { gte: since, lt: until } },
      orderBy: { day: "asc" },
    }),
    getCotacaoUsdBrl(),
  ]);

  const totais = {
    custoUsd: 0, mensagens: 0,
    mensagensPagas: 0, mensagensGratis: 0,
  };
  const porCategoria = {};   // categoria → { volume, custoUsd }
  const custoPorCategoria = {}; // categoria → custoUsd (insumo do rateio)
  const porDiaMap = new Map();

  for (const l of linhas) {
    const pago = isPaga(l);
    totais.custoUsd += l.costUsd;
    totais.mensagens += l.volume;
    if (pago) totais.mensagensPagas += l.volume;
    else totais.mensagensGratis += l.volume;

    if (!porCategoria[l.category]) {
      porCategoria[l.category] = { volume: 0, custoUsd: 0, volumePago: 0, volumeGratis: 0 };
    }
    const c = porCategoria[l.category];
    c.volume += l.volume;
    c.custoUsd += l.costUsd;
    if (pago) c.volumePago += l.volume; else c.volumeGratis += l.volume;

    custoPorCategoria[l.category] = (custoPorCategoria[l.category] ?? 0) + l.costUsd;

    const k = l.day.toISOString().slice(0, 10);
    if (!porDiaMap.has(k)) porDiaMap.set(k, { day: k, custoUsd: 0, mensagens: 0 });
    const d = porDiaMap.get(k);
    d.custoUsd += l.costUsd;
    d.mensagens += l.volume;
  }

  const clinicas = await ratearPorClinica({ since, until, custoPorCategoria });
  const atribuido = clinicas.reduce((s, c) => s + c.custoUsd, 0);

  const arred = (n) => Number(n.toFixed(4));

  // Custo médio por mensagem paga — o número que interessa para precificar cota.
  const custoMedioPago = totais.mensagensPagas > 0 ? totais.custoUsd / totais.mensagensPagas : 0;

  const ultimaSync = linhas.reduce(
    (max, l) => (!max || l.syncedAt > max ? l.syncedAt : max),
    null
  );

  return {
    periodo: { since, until, days },
    ultimaSync,
    // Estimativa em reais. USD continua sendo o valor de fato — isto é uma
    // conveniência de leitura, e vem null quando a fonte de câmbio falha,
    // caso em que a tela simplesmente não mostra o card.
    cambio: cambio && {
      usdBrl: Number(cambio.valor.toFixed(4)),
      custoBrlEstimado: Number((totais.custoUsd * cambio.valor).toFixed(2)),
      fonte: cambio.fonte,
      cotadoEm: cambio.cotadoEm ?? null,
      expirada: cambio.expirada ?? false,
    },
    totais: {
      ...totais,
      custoUsd: arred(totais.custoUsd),
      custoMedioPagoUsd: arred(custoMedioPago),
    },
    porCategoria: Object.entries(porCategoria)
      .map(([categoria, v]) => ({
        categoria,
        ...v,
        custoUsd: arred(v.custoUsd),
        custoMedioUsd: v.volumePago > 0 ? arred(v.custoUsd / v.volumePago) : 0,
      }))
      .sort((a, b) => b.custoUsd - a.custoUsd),
    // Série contínua: dia sem envio vale ZERO, não some. Só os dias com linha no
    // banco fariam o gráfico desenhar um buraco de duas semanas igual a três
    // dias seguidos — num eixo temporal isso mente sobre o consumo.
    porDia: Array.from({ length: days }, (_, i) => {
      const dia = new Date(since.getTime() + i * 86400000);
      const k = dia.toISOString().slice(0, 10);
      const d = porDiaMap.get(k) ?? { day: k, custoUsd: 0, mensagens: 0 };
      return { ...d, custoUsd: arred(d.custoUsd) };
    }),
    clinicas,
    naoAtribuido: arred(Math.max(0, totais.custoUsd - atribuido)),
  };
}
