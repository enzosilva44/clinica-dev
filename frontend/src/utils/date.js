// Helpers para datas-só (sem hora), como nascimento e vencimento.
//
// Contexto do bug: inputs type="date" produzem "YYYY-MM-DD". O JS parseia
// isso como meia-noite UTC, e o backend salva assim (ex.: 2026-07-10T00:00Z).
// Ao exibir no fuso do Brasil (UTC-3), toLocaleDateString mostra o dia
// ANTERIOR (09). Para datas puras, formatamos em UTC para exibir o dia como
// foi digitado, evitando o deslocamento de fuso.

// Formata uma data-só (Date, ISO string ou "YYYY-MM-DD") em pt-BR sem shift.
export function fmtDateOnly(value, opts = {}) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", ...opts });
}

// Idem, formato curto (dia/mês).
export function fmtDateOnlyShort(value) {
  return fmtDateOnly(value, { day: "2-digit", month: "short" });
}
