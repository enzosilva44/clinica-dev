const META_API_VERSION = "v20.0";

// Cliente da Graph API para /{WABA_ID}/pricing_analytics — a MESMA fonte que
// alimenta o card "Preços das mensagens" do WhatsApp Manager. É o único
// endpoint que devolve custo real cobrado; os de messaging_analytics contam
// mensagens, não dinheiro.
//
// Chamado só pelo cron (1×/dia). NÃO usar em request de usuário: a Graph tem
// rate limit por app e a latência é alta — a tela lê do cache em banco.

// A Meta agrega os dados com atraso e REVISA os números por ~2 dias. Puxar só
// "ontem" congela um valor que ainda vai mudar; por isso a janela padrão volta
// alguns dias e o serviço regrava tudo (upsert).
export const DIAS_REVISAO = 3;

function assertConfig() {
  const wabaId = process.env.WHATSAPP_WABA_ID;
  // Token precisa de whatsapp_business_management no WABA. Idealmente um token
  // de SISTEMA — o de usuário expira e o painel para de atualizar em silêncio.
  const accessToken = process.env.WHATSAPP_COST_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!wabaId || !accessToken) {
    throw new Error(
      "Custo do WhatsApp não configurado — defina WHATSAPP_WABA_ID e WHATSAPP_ACCESS_TOKEN (ou WHATSAPP_COST_TOKEN)."
    );
  }
  return { wabaId, accessToken };
}

// Timestamps da Graph são epoch em SEGUNDOS, UTC.
function toEpoch(date) {
  return Math.floor(date.getTime() / 1000);
}

// Normaliza para 00:00 UTC — a chave temporal das linhas diárias.
export function diaUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Busca o custo por dia × categoria × tipo de preço na janela [since, until).
// Retorna linhas cruas normalizadas; quem persiste é o service.
export async function fetchPricingAnalytics({ since, until }) {
  const { wabaId, accessToken } = assertConfig();

  // Sintaxe da Graph: cada parâmetro é um par chave.valor dentro de
  // .parameters(...) — NÃO um blob JSON. Passar um objeto JSON faz a Meta
  // responder "(#100) The parameter start is required", porque ela não enxerga
  // os campos de dentro. Listas (metric_types/dimensions) vão como JSON array.
  const parameters = [
    `start.${toEpoch(since)}`,
    `end.${toEpoch(until)}`,
    `granularity.DAILY`,
    `metric_types.${JSON.stringify(["COST", "VOLUME"])}`,
    `dimensions.${JSON.stringify(["PRICING_CATEGORY", "PRICING_TYPE"])}`,
  ].join(",");

  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${wabaId}` +
    `?fields=pricing_analytics.parameters(${parameters})`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Erro ${res.status} na Graph API (pricing_analytics)`);
  }

  const points = data?.pricing_analytics?.data?.[0]?.data_points ?? [];

  return points.map((p) => ({
    // `start` é o início do bucket diário.
    day: diaUTC(new Date((p.start ?? 0) * 1000)),
    category: p.pricing_category ?? "UNKNOWN",
    pricing: p.pricing_type ?? "UNKNOWN",
    volume: Number(p.volume ?? 0),
    costUsd: Number(p.cost ?? 0),
    wabaId,
  }));
}
