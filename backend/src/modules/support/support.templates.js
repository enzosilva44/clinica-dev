// Catálogo dos templates que a Central pode enviar ao INICIAR uma conversa.
//
// Existe porque fora da janela de 24h a Meta só aceita template aprovado — e o
// atendente precisa escolher um numa lista, não decorar nomes técnicos. Cada
// entrada descreve o template para a tela: rótulo, para que serve, e quais
// campos o atendente preenche.
//
// O COMERCIAL vai definir os outros tipos de mensagem. Para adicionar um novo:
//   1. escreva o template em scripts/create-templates.js e submeta à Meta;
//   2. espere APPROVED (o envio falha com 132001 se o nome não existir lá);
//   3. acrescente uma entrada aqui, na mesma ordem de variáveis do corpo.
// Nada mais no código precisa mudar — a tela lê esta lista.
//
// `fields` está na ORDEM das variáveis do corpo ({{1}}, {{2}}, …). É essa ordem
// que vira o array de parâmetros no envio, então trocá-la aqui troca o
// significado da mensagem que chega no cliente.

export const OUTREACH_TEMPLATES = [
  {
    name: "prospeccao_iaso",
    label: "Prospecção — primeiro contato",
    description:
      "Apresenta a IASO para quem nunca falou com a gente. Categoria MARKETING, com opt-out.",
    category: "MARKETING",
    language: "pt_BR",
    fields: [
      {
        key: "nome",
        label: "Nome de quem vai receber",
        placeholder: "Fernanda",
        required: true,
        maxLength: 60,
      },
      {
        key: "mensagem",
        label: "Motivo do contato",
        hint:
          "Escrito por você, entra no meio da mensagem. Genérico demais é o que faz a pessoa ignorar — cite algo concreto sobre a clínica dela.",
        placeholder:
          "Vi que você atende harmonização em Ribeirão e queria te mostrar como a IASO organiza agenda, prontuário e financeiro num lugar só.",
        required: true,
        multiline: true,
        maxLength: 600,
      },
    ],
    // Como a mensagem fica, para a tela mostrar antes de enviar. {{n}} são
    // substituídos pelos valores digitados.
    preview:
      "Olá {{1}}! Aqui é a IASO Tecnologia, sistema de gestão para clínicas de estética. 💚\n\n" +
      "{{2}}\n\n" +
      "Se quiser saber mais, é só responder esta mensagem.\n" +
      "Se preferir não receber mais contatos, responda SAIR.",
  },
];

export function findOutreachTemplate(name) {
  return OUTREACH_TEMPLATES.find((t) => t.name === name) ?? null;
}

// Valida o que o atendente preencheu e devolve os valores na ordem das
// variáveis do corpo. Mensagem de erro é para o atendente ler na tela, então
// cita o rótulo do campo, não a chave.
//
// A Meta recusa parâmetro com quebra de linha ou espaços duplicados (erro 132000
// / "invalid parameter"), e isso é fácil de acontecer em campo multilinha
// colado de outro lugar — por isso normalizamos aqui em vez de deixar falhar no
// envio, quando a causa já não é óbvia.
export function buildTemplateParams(template, values = {}) {
  const params = [];

  for (const field of template.fields ?? []) {
    const raw = values[field.key];
    const text = String(raw ?? "").replace(/\s+/g, " ").trim();

    if (!text) {
      if (field.required) throw new Error(`Preencha "${field.label}".`);
      // Parâmetro vazio faz a Meta recusar a mensagem inteira; espaço mantém a
      // posição do {{n}} sem quebrar o envio.
      params.push(" ");
      continue;
    }

    if (field.maxLength && text.length > field.maxLength) {
      throw new Error(`"${field.label}" passou de ${field.maxLength} caracteres.`);
    }

    params.push(text);
  }

  return params;
}

// Texto que vai para a timeline e para o preview do ticket. A Central precisa
// mostrar o que o cliente recebeu — guardar só "template prospeccao_iaso"
// deixaria o atendente sem contexto na hora de dar sequência à conversa.
export function renderTemplateText(template, params) {
  let out = template.preview ?? "";
  params.forEach((value, i) => {
    out = out.replaceAll(`{{${i + 1}}}`, value);
  });
  return out.trim();
}
