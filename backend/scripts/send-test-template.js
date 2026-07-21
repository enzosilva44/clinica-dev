// Envio de teste de um Message Template aprovado na Meta.
// Uso:  node scripts/send-test-template.js 5516999999999
// (passe o número destino como argumento; ou edite TO abaixo)
//
// Lê WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN do backend/.env
import "dotenv/config";

// ==== CHUMBE AQUI (bata com o template APROVADO no WhatsApp Manager) ====
const TEMPLATE_NAME = "lembrete_consulta"; // nome EXATO do template aprovado
const LANGUAGE = "pt_BR";                    // código de idioma do template
// Variáveis do corpo, na ordem {{1}}, {{2}}, {{3}}...
const PARAMS = ["Enzo", "20/07/2026", "15:30"];
// Número destino: 1º argumento da linha de comando, ou o fixo abaixo
const TO = process.argv[2] || "5516999999999";
// =======================================================================

const META_API_VERSION = "v20.0";
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

if (!phoneNumberId || !accessToken) {
  console.error("Faltam WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN no .env");
  process.exit(1);
}

let to = TO.replace(/\D/g, "");
if (!to.startsWith("55")) to = "55" + to;

const components = PARAMS.length
  ? [{ type: "body", parameters: PARAMS.map((text) => ({ type: "text", text: String(text) })) }]
  : [];

const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: { name: TEMPLATE_NAME, language: { code: LANGUAGE }, components },
};

console.log("Enviando para", to, "→ template:", TEMPLATE_NAME, "params:", PARAMS);

const res = await fetch(
  `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }
);

const data = await res.json();
if (!res.ok) {
  console.error("❌ Erro:", JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log("✅ Enviado! message id:", data.messages?.[0]?.id);
console.log(JSON.stringify(data, null, 2));
