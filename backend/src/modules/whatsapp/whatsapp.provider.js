const META_API_VERSION = "v20.0";

// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPTOR GERAL DE ENVIO (kill switch)
//
// Com WHATSAPP_SEND_ENABLED="false" NENHUMA mensagem sai para a Meta: as duas
// funções abaixo retornam uma resposta simulada, sem tocar a rede. O resto do
// fluxo (log, cota, timeline do Conversas) continua rodando normalmente, porque
// o formato do retorno é o mesmo da Meta — inclusive messages[0].id.
//
// Só envia de verdade quando a variável está explicitamente "true". Ou seja,
// ambiente sem a variável definida fica MUDO por padrão — é o lado seguro.
// Para religar: WHATSAPP_SEND_ENABLED=true no .env e reiniciar o processo.
// ─────────────────────────────────────────────────────────────────────────────
function sendingEnabled() {
  return String(process.env.WHATSAPP_SEND_ENABLED ?? "").toLowerCase() === "true";
}

// Resposta no mesmo formato da Meta, com id marcado p/ ser reconhecível no banco.
function simulatedResult(to) {
  return {
    messaging_product: "whatsapp",
    contacts: [{ wa_id: to }],
    messages: [{ id: `simulated.${Date.now()}.${Math.random().toString(36).slice(2, 10)}` }],
    simulated: true,
  };
}

export async function sendWhatsAppMessage(phone, message, config = {}) {
  const phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = config.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp não configurado — adicione Phone Number ID e Access Token.");
  }

  let to = phone.replace(/\D/g, "");
  if (!to.startsWith("55")) to = "55" + to;

  if (!sendingEnabled()) {
    console.warn(`[whatsapp] ENVIO BLOQUEADO (WHATSAPP_SEND_ENABLED != true) — texto p/ ${to} não enviado.`);
    return simulatedResult(to);
  }

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Erro ${res.status} na Meta API`;
    throw new Error(msg);
  }
  return data;
}

// Envia via Message Template aprovado na Meta (obrigatório fora da janela de 24h).
// params = array ordenado de strings, mapeado para {{1}}, {{2}}... na ordem.
//
// config.urlButtonParam: templates com botão de URL dinâmica (ex.: aviso_fatura_iaso,
// cujo botão é "https://www.asaas.com/i/{{1}}") exigem um component "button" à parte,
// com APENAS o trecho variável da URL — o prefixo já está fixo no template aprovado.
export async function sendWhatsAppTemplate(phone, templateName, params, config = {}) {
  const phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken   = config.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN;
  const language      = config.language      || "pt_BR";

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp não configurado — adicione Phone Number ID e Access Token.");
  }

  let to = phone.replace(/\D/g, "");
  if (!to.startsWith("55")) to = "55" + to;

  if (!sendingEnabled()) {
    console.warn(`[whatsapp] ENVIO BLOQUEADO (WHATSAPP_SEND_ENABLED != true) — template "${templateName}" p/ ${to} não enviado.`);
    return simulatedResult(to);
  }

  const components = [];
  if (params.length) {
    components.push({ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text) })) });
  }
  if (config.urlButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: String(config.urlButtonParam) }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: templateName, language: { code: language }, components },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Erro ${res.status} na Meta API`;
    throw new Error(msg);
  }
  return data;
}
