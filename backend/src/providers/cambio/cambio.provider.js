// Cotação do dólar comercial, usada para estimar em reais custos que os
// fornecedores cobram em USD (hoje: o WhatsApp da Meta).
//
// Sempre uma ESTIMATIVA: a fatura real ainda passa por spread e IOF do cartão,
// que variam por emissor. Quem exibe deve deixar isso claro.

// Fontes em cascata, na ordem. A primeira que responder vence.
//
// Duas porque nenhuma é confiável sozinha num IP de datacenter: a AwesomeAPI
// devolve 429 de forma persistente para o IP da EC2 (limite do plano grátis
// por origem), enquanto responde normalmente de uma máquina doméstica. Não dá
// para descobrir isso testando só no local — descoberto em produção.
const FONTES = [
  {
    nome: "AwesomeAPI",
    url: "https://economia.awesomeapi.com.br/json/last/USD-BRL",
    // `bid` é a compra — o lado que interessa para estimar quanto custa em BRL.
    extrair: (d) => ({
      valor: Number(d?.USDBRL?.bid),
      cotadoEm: d?.USDBRL?.create_date ?? null,
    }),
  },
  {
    nome: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    extrair: (d) => ({
      valor: Number(d?.rates?.BRL),
      cotadoEm: d?.time_last_update_utc ?? null,
    }),
  },
];

// Cache em memória. A cotação varia por minuto, mas o painel não precisa desse
// frescor — e sem cache cada abertura da tela viraria uma chamada externa.
const TTL_MS = 10 * 60 * 1000;

// Timeout curto: o câmbio é enfeite no painel. Se a fonte estiver lenta,
// preferimos devolver null e mostrar só USD a segurar a tela carregando.
const TIMEOUT_MS = 4000;

let cache = null; // { valor, obtidoEm, cotadoEm, fonte }

export function limparCacheCambio() {
  cache = null;
}

async function consultar(fonte) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(fonte.url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { valor, cotadoEm } = fonte.extrair(await res.json());
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("cotação inválida");
    return { valor, cotadoEm, fonte: fonte.nome };
  } finally {
    clearTimeout(t);
  }
}

// Retorna { valor, obtidoEm, cotadoEm, fonte, doCache } ou null se nenhuma
// fonte respondeu. NUNCA lança: câmbio indisponível não derruba o painel.
export async function getCotacaoUsdBrl() {
  if (cache && Date.now() - cache.obtidoEm < TTL_MS) {
    return { ...cache, doCache: true };
  }

  const falhas = [];
  for (const fonte of FONTES) {
    try {
      const r = await consultar(fonte);
      cache = { ...r, obtidoEm: Date.now() };
      return { ...cache, doCache: false };
    } catch (e) {
      falhas.push(`${fonte.nome}: ${e.message}`);
    }
  }

  // Cotação vencida ainda é melhor que nenhuma: marcamos como `expirada` para
  // a tela poder avisar que o número não é do minuto.
  if (cache) return { ...cache, doCache: true, expirada: true };

  console.error("[Câmbio] nenhuma fonte respondeu —", falhas.join(" | "));
  return null;
}
