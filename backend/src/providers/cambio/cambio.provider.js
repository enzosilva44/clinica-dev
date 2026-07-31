// Cotação do dólar comercial, usada para estimar em reais custos que os
// fornecedores cobram em USD (hoje: o WhatsApp da Meta).
//
// Fonte: AwesomeAPI (economia.awesomeapi.com.br) — pública, sem chave, e
// devolve a cotação comercial com timestamp. Não é fonte oficial do Banco
// Central: serve para dar ordem de grandeza no painel, não para contabilidade.
//
// Sempre uma ESTIMATIVA: a fatura real ainda passa por spread e IOF do cartão,
// que variam por emissor. Quem exibe deve deixar isso claro.

const URL_COTACAO = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

// Cache em memória. A cotação varia por minuto, mas o painel não precisa desse
// frescor — e sem cache cada abertura da tela viraria uma chamada externa.
const TTL_MS = 10 * 60 * 1000;

// Timeout curto: o câmbio é enfeite no painel. Se a fonte estiver lenta,
// preferimos devolver null e mostrar só USD a segurar a tela carregando.
const TIMEOUT_MS = 4000;

let cache = null; // { valor, obtidoEm, fonte }

export function limparCacheCambio() {
  cache = null;
}

// Retorna { valor, obtidoEm, fonte, doCache } ou null se não deu para obter.
// NUNCA lança: câmbio indisponível não pode derrubar o painel de custo.
export async function getCotacaoUsdBrl() {
  if (cache && Date.now() - cache.obtidoEm < TTL_MS) {
    return { ...cache, doCache: true };
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(URL_COTACAO, { signal: ctrl.signal });
    clearTimeout(t);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    // `bid` é a compra — o lado que interessa para estimar quanto custa em BRL.
    const valor = Number(data?.USDBRL?.bid);
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("cotação inválida");

    cache = {
      valor,
      obtidoEm: Date.now(),
      // Horário informado pela própria fonte, não o nosso — é o instante a que
      // a cotação se refere.
      cotadoEm: data?.USDBRL?.create_date ?? null,
      fonte: "AwesomeAPI",
    };
    return { ...cache, doCache: false };
  } catch (e) {
    // Cotação vencida ainda é melhor que nenhuma: marcamos como `expirada` para
    // a tela poder avisar que o número não é do minuto.
    if (cache) return { ...cache, doCache: true, expirada: true };
    console.error("[Câmbio] não foi possível obter USD/BRL:", e.message);
    return null;
  }
}
