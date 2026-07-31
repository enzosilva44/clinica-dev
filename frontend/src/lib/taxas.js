// Estimativa de líquido — espelho de backend/src/config/taxas.js.
//
// Existe duplicado porque o preview no modal de agendamento precisa reagir a
// cada mudança de valor/meio sem ida ao servidor. Os números são os mesmos e
// devem ser alterados nos DOIS arquivos.
//
// Valores cheios de tabela do Asaas (a promoção de 3 meses é ignorada de
// propósito: quando expirar, o número continua certo).

const TAXAS = {
  pix:         { fixo: 1.99, percent: 0 },
  boleto:      { fixo: 1.99, percent: 0 },
  debito:      { fixo: 0.35, percent: 1.89 },
  credit_card: { fixo: 0.49, percent: 2.99 },
};

// Crédito parcelado: percentual por faixa de parcelas.
const FAIXAS_CREDITO = [
  { ate: 1,  percent: 2.99 },
  { ate: 6,  percent: 3.49 },
  { ate: 12, percent: 3.99 },
  { ate: 21, percent: 4.29 },
];

// Split IASOPay, além da taxa da adquirente.
const SPLIT = {
  pix:         { fixo: 0.30, percent: 0 },
  boleto:      { fixo: 0.30, percent: 0 },
  debito:      { fixo: 0,    percent: 0.20 },
  credit_card: { fixo: 0,    percent: 0.20 },
};

const round2 = (n) => Math.round(n * 100) / 100;

export function estimarLiquido(valor, metodo, { parcelas = 1 } = {}) {
  const bruto = Number(valor);
  if (!Number.isFinite(bruto) || bruto <= 0) return null;

  const base = TAXAS[metodo];
  if (!base) return null;

  let percent = base.percent;
  if (metodo === "credit_card") {
    const n = Math.max(1, Number(parcelas) || 1);
    percent = (FAIXAS_CREDITO.find((f) => n <= f.ate) ?? FAIXAS_CREDITO.at(-1)).percent;
  }

  const taxa = round2(base.fixo + (bruto * percent) / 100);
  const cfg = SPLIT[metodo];
  const split = round2(cfg.fixo + (bruto * cfg.percent) / 100);

  return {
    bruto: round2(bruto),
    taxa,
    split,
    liquido: round2(bruto - taxa - split),
    detalhe: percent
      ? `R$ ${base.fixo.toFixed(2).replace(".", ",")} + ${percent.toFixed(2).replace(".", ",")}%`
      : `R$ ${base.fixo.toFixed(2).replace(".", ",")}`,
  };
}

export const brl = (v) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
