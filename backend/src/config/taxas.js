// Taxas do Asaas + split da IASOPay. Fonte única para o cálculo de líquido.
//
// Valores CHEIOS de tabela (a promoção de 3 meses do Asaas — PIX/boleto a
// R$ 0,99 — é deliberadamente ignorada: quando ela expirar, o valor exibido
// continua correto, e é melhor a clínica receber a mais do que a menos).
//
// Enquanto a cobrança não é paga, o resultado é ESTIMATIVA. O valor real vem
// do webhook do Asaas (netValue), que grava netAmount/feeAmount na Transaction.
// Ver billing.service.js.

// Taxa da adquirente por meio de pagamento.
// fixo em R$ + percent sobre o valor bruto.
export const TAXAS_ASAAS = {
  pix:    { fixo: 1.99, percent: 0 },
  boleto: { fixo: 1.99, percent: 0 },
  debito: { fixo: 0.35, percent: 1.89 },
  // Crédito muda por faixa de parcelas — ver TAXA_CREDITO_POR_FAIXA.
  credito: { fixo: 0.49, percent: 2.99 },
};

// Crédito parcelado: o percentual sobe conforme a faixa. O fixo é sempre 0,49.
// [maxParcelas, percent] — a primeira faixa que couber vence.
const TAXA_CREDITO_POR_FAIXA = [
  { ate: 1,  percent: 2.99 },
  { ate: 6,  percent: 3.49 },
  { ate: 12, percent: 3.99 },
  { ate: 21, percent: 4.29 },
];

// Split da IASOPay, cobrado sobre o bruto além da taxa da adquirente.
export const SPLIT_IASOPAY = {
  pix:     { fixo: 0.30, percent: 0 },
  boleto:  { fixo: 0.30, percent: 0 },
  debito:  { fixo: 0,    percent: 0.20 },
  credito: { fixo: 0,    percent: 0.20 },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Normaliza os vários nomes que circulam no sistema para as chaves acima.
// O front usa "credit_card"/"pix"/"boleto"; o financeiro usa rótulos em PT.
function normalizaMetodo(metodo) {
  const m = String(metodo ?? "").toLowerCase().trim();
  if (m.includes("pix")) return "pix";
  if (m.includes("boleto")) return "boleto";
  if (m.includes("debito") || m.includes("débito") || m === "debit_card") return "debito";
  if (m.includes("credito") || m.includes("crédito") || m.includes("credit") || m.includes("cartão") || m.includes("cartao")) return "credito";
  return null;
}

/**
 * Estimativa de quanto a clínica recebe.
 *
 * @param {number} valor      bruto da cobrança
 * @param {string} metodo     pix | boleto | debito | credito (aceita variações)
 * @param {number} parcelas   nº de parcelas (só afeta crédito)
 * @param {boolean} comSplit  descontar o split da IASOPay (default: sim)
 * @returns {{bruto,taxaAsaas,split,liquido,estimativa,metodo,detalhe}|null}
 *          null quando o método é desconhecido — o chamador decide o que exibir.
 */
export function estimarLiquido(valor, metodo, { parcelas = 1, comSplit = true } = {}) {
  const bruto = Number(valor);
  if (!Number.isFinite(bruto) || bruto <= 0) return null;

  const key = normalizaMetodo(metodo);
  if (!key) return null;

  const base = TAXAS_ASAAS[key];
  let percent = base.percent;
  if (key === "credito") {
    const n = Math.max(1, Number(parcelas) || 1);
    percent = (TAXA_CREDITO_POR_FAIXA.find((f) => n <= f.ate)
      ?? TAXA_CREDITO_POR_FAIXA[TAXA_CREDITO_POR_FAIXA.length - 1]).percent;
  }

  const taxaAsaas = round2(base.fixo + (bruto * percent) / 100);

  const cfgSplit = SPLIT_IASOPAY[key];
  const split = comSplit
    ? round2(cfgSplit.fixo + (bruto * cfgSplit.percent) / 100)
    : 0;

  return {
    bruto: round2(bruto),
    taxaAsaas,
    split,
    liquido: round2(bruto - taxaAsaas - split),
    estimativa: true,
    metodo: key,
    // Texto pronto para a UI, ex.: "R$ 0,49 + 3,49%" (percent já é o da faixa).
    detalhe: base.fixo && percent
      ? `R$ ${base.fixo.toFixed(2).replace(".", ",")} + ${percent.toFixed(2).replace(".", ",")}%`
      : base.fixo
        ? `R$ ${base.fixo.toFixed(2).replace(".", ",")}`
        : `${percent.toFixed(2).replace(".", ",")}%`,
  };
}
