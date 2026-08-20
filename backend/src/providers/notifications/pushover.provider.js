// Pushover — push no celular da equipe IASO.
//
// Serve para o que ninguém fica olhando na tela: mensagem nova na central de
// suporte. Sem ele, um cliente escrevendo às 19h só é visto quando alguém abre
// a Central por acaso.
//
// Sem PUSHOVER_TOKEN/PUSHOVER_USER_KEY o envio é NO-OP silencioso (só um aviso
// no log na primeira vez). Ambiente sem credencial não deve quebrar nada — o
// ticket já está gravado, o push é o extra.

const API = "https://api.pushover.net/1/messages.json";

let avisouFaltaDeConfig = false;

function config() {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) {
    if (!avisouFaltaDeConfig) {
      console.warn("[pushover] PUSHOVER_TOKEN/PUSHOVER_USER_KEY ausentes — notificações desligadas.");
      avisouFaltaDeConfig = true;
    }
    return null;
  }
  return { token, user };
}

// Envia um push. NÃO lança: quem chama está no meio de processar um webhook da
// Meta, e um erro do Pushover não pode derrubar (nem reenfileirar) o evento —
// isso reprocessaria a mensagem do cliente por causa de uma notificação.
// Devolve true/false só para quem quiser logar.
export async function sendPush({ title, message, url, urlTitle, priority = 0 }) {
  const cfg = config();
  if (!cfg) return false;

  try {
    const body = new URLSearchParams({
      token: cfg.token,
      user: cfg.user,
      title: String(title ?? "IASO"),
      // A API recusa mensagem vazia; texto de mídia sem legenda cai aqui.
      message: String(message || "(sem texto)").slice(0, 1024),
      priority: String(priority),
    });
    if (url) body.set("url", url);
    if (urlTitle) body.set("url_title", urlTitle);

    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error(`[pushover] falha ${res.status}: ${detalhe.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[pushover] erro ao notificar:", e.message);
    return false;
  }
}
