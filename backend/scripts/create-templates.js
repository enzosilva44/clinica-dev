// Cria (ou re-submete) os Message Templates do Iasoclin na Meta, de uma vez.
//
// Uso:
//   node scripts/create-templates.js                 # usa WHATSAPP_WABA_ID do .env
//   node scripts/create-templates.js <WABA_ID>       # ou passa o WABA_ID como argumento
//   node scripts/create-templates.js <WABA_ID> lembrete_consulta   # só um template
//
// Precisa de:
//   WHATSAPP_ACCESS_TOKEN   (token com permissão whatsapp_business_management)
//   WHATSAPP_WABA_ID        (o ID da WhatsApp Business Account — NÃO é o phone number id)
//
// Onde achar o WABA_ID: WhatsApp Manager → Configurações → ID da conta,
// ou Meta Business Suite. É diferente do WHATSAPP_PHONE_NUMBER_ID usado no envio.
import "dotenv/config";

const META_API_VERSION = "v20.0";
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const wabaId = process.argv[2] || process.env.WHATSAPP_WABA_ID;
const onlyName = process.argv[3]; // opcional: cria só o template com esse nome

if (!accessToken) {
  console.error("❌ Falta WHATSAPP_ACCESS_TOKEN no .env");
  process.exit(1);
}
if (!wabaId) {
  console.error("❌ Falta o WABA_ID. Passe como argumento ou defina WHATSAPP_WABA_ID no .env");
  console.error("   Ex.: node scripts/create-templates.js 1234567890");
  process.exit(1);
}

// ==== Definição dos templates (bate com docs/whatsapp-templates.md) ====
const TEMPLATES = [
  {
    // v2: já existe um "lembrete_consulta" APROVADO como MARKETING na WABA;
    // a Meta não deixa recriar o mesmo nome com outra categoria. Este é UTILITY
    // (mais barato) e com campos ricos (clínica + profissional).
    name: "lembrete_consulta_v2",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text:
          "Oi, {{1}}! Passando pra lembrar da sua consulta na {{2}}.\n\n" +
          "📅 {{3}} às {{4}}\n" +
          "👩‍⚕️ {{5}}\n\n" +
          "Qualquer imprevisto, é só nos avisar por aqui. Até lá!",
        example: { body_text: [["Maria", "Clínica Becari", "28/07/2026", "15:30", "Dra. Fernanda"]] },
      },
    ],
  },
  {
    name: "confirmacao_consulta",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text:
          "Oi, {{1}}! Sua consulta na {{2}} está marcada para {{3}} às {{4}}.\n\n" +
          "Pode confirmar pra gente? Se precisar remarcar, é só tocar abaixo que a gente ajeita.",
        example: { body_text: [["Maria", "Clínica Becari", "28/07/2026", "15:30"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Confirmar presença" },
          { type: "QUICK_REPLY", text: "Preciso remarcar" },
        ],
      },
    ],
  },
  {
    name: "retorno_paciente",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text:
          "Oi, {{1}}! Como parte do seu acompanhamento na {{2}}, chegou o momento do seu retorno.\n\n" +
          "Recomendação: {{3}}\n\n" +
          "Quer que a gente já reserve um horário pra você? É só responder por aqui.",
        example: {
          body_text: [["Maria", "Clínica Becari", "retorno de 30 dias após o preenchimento"]],
        },
      },
    ],
  },
  {
    name: "reativacao_paciente",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text:
          "Oi, {{1}}! Sentimos sua falta na {{2}}. 💚\n\n" +
          "{{3}}\n\n" +
          "Se quiser agendar, é só responder esta mensagem.\n" +
          "Se preferir não receber mais estes avisos, responda SAIR.",
        example: {
          body_text: [
            ["Maria", "Clínica Becari", "Este mês, avaliação de skincare sem custo pra clientes que voltam."],
          ],
        },
      },
    ],
  },
  {
    name: "aviso_fatura",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text:
          "Oi, {{1}}! Passando pra avisar sobre um valor em aberto na {{2}}.\n\n" +
          "💰 Valor: {{3}}\n" +
          "📅 Vencimento: {{4}}\n\n" +
          "Você pode pagar pelo link abaixo. Se já pagou, pode ignorar — pode levar até 1 dia útil pra compensar. Qualquer dúvida, é só chamar.",
        example: { body_text: [["Maria", "Clínica Becari", "R$ 199,00", "30/07/2026"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Pagar agora",
            url: "https://www.asaas.com/i/{{1}}",
            example: ["https://www.asaas.com/i/abc123"],
          },
        ],
      },
    ],
  },
];

async function createTemplate(tpl) {
  const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tpl),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

const toCreate = onlyName ? TEMPLATES.filter((t) => t.name === onlyName) : TEMPLATES;

if (!toCreate.length) {
  console.error(`❌ Nenhum template com nome "${onlyName}". Nomes: ${TEMPLATES.map((t) => t.name).join(", ")}`);
  process.exit(1);
}

console.log(`Criando ${toCreate.length} template(s) na WABA ${wabaId}...\n`);

let okCount = 0;
for (const tpl of toCreate) {
  const { ok, data } = await createTemplate(tpl);
  if (ok) {
    okCount++;
    console.log(`✅ ${tpl.name}  → id: ${data.id}  status: ${data.status || "PENDING"}`);
  } else {
    const err = data?.error;
    console.log(`❌ ${tpl.name}  → ${err?.error_user_msg || err?.message || JSON.stringify(data)}`);
    if (err?.error_user_title) console.log(`   (${err.error_user_title})`);
  }
}

console.log(`\nConcluído: ${okCount}/${toCreate.length} enviados para análise.`);
console.log("Acompanhe a aprovação em WhatsApp Manager → Modelos de mensagem.");
