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

// `status` reflete a análise da Meta, e é atualizado À MÃO aqui quando o
// template sai de PENDING (conferir em WhatsApp Manager → Modelos de mensagem,
// ou via GET /{WABA}/message_templates). Só "APPROVED" pode ser enviado: com
// qualquer outro valor a Meta recusa com 132001, então a tela desabilita a
// opção em vez de deixar o atendente descobrir clicando.
export const OUTREACH_TEMPLATES = [
  {
    name: "prospeccao_iaso",
    label: "Prospecção — primeiro contato",
    description:
      "Apresenta a IASO para quem nunca falou com a gente. Categoria MARKETING, com opt-out.",
    // Submetido em 19/08/2026 (id 1077894137965802). Trocar para "APPROVED"
    // quando a Meta aprovar — é isso que libera o envio na Central.
    status: "PENDING",
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

// Template só de teste, para os testes da janela de 24h e do ciclo de conversa
// não dependerem do status real de um template de produção — que muda quando a
// Meta aprova ou reprova, e faria a suíte quebrar sozinha.
// Fora de NODE_ENV=test ele não existe, então nunca aparece para o atendente.
const TEMPLATE_DE_TESTE = {
  name: "_teste_iaso",
  label: "Teste automatizado",
  description: "Não aparece na Central — existe só para a suíte de testes.",
  status: "APPROVED",
  category: "UTILITY",
  language: "pt_BR",
  fields: [
    { key: "nome", label: "Nome", required: true, maxLength: 60 },
    { key: "mensagem", label: "Mensagem", required: true, multiline: true, maxLength: 600 },
  ],
  preview: "Olá {{1}}! {{2}}",
};

export function findOutreachTemplate(name) {
  if (name === TEMPLATE_DE_TESTE.name && process.env.NODE_ENV === "test") {
    return TEMPLATE_DE_TESTE;
  }
  return OUTREACH_TEMPLATES.find((t) => t.name === name) ?? null;
}

// Só template aprovado sai. Sem esta checagem o atendente escreve a mensagem
// inteira, clica em enviar e recebe o 132001 cru da Meta ("template name does
// not exist"), que não diz que é só esperar a análise terminar.
export function assertTemplateEnviavel(template) {
  if (template.status === "APPROVED") return;

  if (template.status === "PENDING") {
    throw new Error(
      `O modelo "${template.label}" ainda está em análise pela Meta. ` +
      "Assim que for aprovado, o envio funciona — nada precisa ser refeito aqui."
    );
  }
  if (template.status === "REJECTED") {
    throw new Error(
      `O modelo "${template.label}" foi reprovado pela Meta e precisa ser reescrito e reenviado.`
    );
  }
  throw new Error(`O modelo "${template.label}" ainda não está liberado para envio.`);
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
