// Regras da triagem — funções PURAS, sem banco e sem rede.
// Isoladas de propósito: são o miolo de decisão do módulo e o que mais muda
// (texto do menu, opções, horário). Ficando puras, dá pra testar sem subir nada.

// Departamentos iniciais da central. `key` é o que fica gravado no ticket.
export const DEPARTMENTS = [
  { key: "comercial",   name: "Comercial",              order: 1, menuLabel: "Quero conhecer a IASO" },
  { key: "suporte",     name: "Suporte",                order: 2, menuLabel: "Preciso de suporte" },
  { key: "financeiro",  name: "Financeiro",             order: 3, menuLabel: "Financeiro e pagamentos" },
  { key: "implantacao", name: "Implantação/CS",         order: 4, menuLabel: "Implantação e treinamento" },
];

// A opção 5 não é departamento: cai na fila geral p/ um humano triar.
export const HUMAN_OPTION = "5";

export function menuText() {
  const linhas = DEPARTMENTS.map((d, i) => `${i + 1} — ${d.menuLabel}`);
  return [
    "Olá! Você está falando com a IASO.",
    "",
    "Para direcionarmos seu atendimento, escolha uma opção:",
    "",
    ...linhas,
    `${HUMAN_OPTION} — Falar com um atendente`,
  ].join("\n");
}

// Interpreta a resposta do cliente ao menu.
// Aceita o número ("2"), o número com pontuação ("2)", "2.") e também o texto
// da opção ("suporte", "financeiro") — gente responde das duas formas.
// Retorna: {type:"department", key} | {type:"human"} | {type:"invalid"}
export function interpretMenuChoice(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return { type: "invalid" };

  // "2", "2)", "2.", "opção 2"
  const numMatch = s.match(/(\d)/);
  if (numMatch) {
    const n = numMatch[1];
    if (n === HUMAN_OPTION) return { type: "human" };
    const idx = Number(n) - 1;
    if (idx >= 0 && idx < DEPARTMENTS.length) {
      return { type: "department", key: DEPARTMENTS[idx].key };
    }
    return { type: "invalid" };
  }

  // Texto livre: casa com a chave ou com palavras do rótulo.
  if (/atendente|humano|pessoa/.test(s)) return { type: "human" };
  const byKey = DEPARTMENTS.find((d) => s.includes(d.key));
  if (byKey) return { type: "department", key: byKey.key };
  if (/vender|conhecer|comprar|pre[çc]o|plano/.test(s)) return { type: "department", key: "comercial" };
  if (/suporte|problema|erro|bug|ajuda/.test(s))        return { type: "department", key: "suporte" };
  if (/financ|pagamento|boleto|fatura|cobran/.test(s))  return { type: "department", key: "financeiro" };
  if (/implanta|treinamento|onboarding/.test(s))        return { type: "department", key: "implantacao" };

  return { type: "invalid" };
}

// Horário de atendimento: seg–sex, 9h–18h (America/Sao_Paulo).
// Recebe a data por parâmetro p/ ser testável sem depender do relógio.
export function isWithinBusinessHours(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = parts.weekday; // Mon..Sun
  const hour = Number(parts.hour);

  if (["Sat", "Sun"].includes(weekday)) return false;
  return hour >= 9 && hour < 18;
}

export function outOfHoursText() {
  return [
    "Recebemos sua mensagem! 🌙",
    "",
    "Nosso atendimento é de segunda a sexta, das 9h às 18h.",
    "Assim que o expediente começar, um atendente responde por aqui.",
  ].join("\n");
}

export function invalidOptionText() {
  return [
    "Não consegui entender a opção. 😅",
    "",
    "Responda com o número de 1 a 5:",
    "",
    ...DEPARTMENTS.map((d, i) => `${i + 1} — ${d.menuLabel}`),
    `${HUMAN_OPTION} — Falar com um atendente`,
  ].join("\n");
}
