import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

// IDs vindos do SEU app na Meta. Preencha no .env do frontend:
//   VITE_META_APP_ID     — App ID (Configurações do app → Básico)
//   VITE_META_CONFIG_ID  — Configuration ID do Embedded Signup
const APP_ID = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID;

// Carrega o SDK do Facebook uma única vez.
function loadFbSdk() {
  return new Promise((resolve) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: "v20.0",
      });
      resolve(window.FB);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  });
}

export default function ConnectWhatsAppButton({ onConnected }) {
  const [status, setStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (APP_ID) loadFbSdk().then(() => setSdkReady(true));
    api.get("/whatsapp/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  function connect() {
    if (!window.FB) return toast.error("SDK do WhatsApp ainda carregando, tente de novo.");
    setLoading(true);

    // Dados que o Embedded Signup devolve (waba_id + phone_number_id) chegam
    // por mensagem postMessage; o code chega no callback do FB.login.
    let embeddedData = {};
    const onMessage = (event) => {
      if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP") {
          embeddedData = data.data || {};
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);

    window.FB.login(
      async (response) => {
        window.removeEventListener("message", onMessage);
        const code = response?.authResponse?.code;
        if (!code) {
          setLoading(false);
          return toast.error("Conexão cancelada.");
        }
        try {
          const res = await api.post("/whatsapp/connect", {
            code,
            wabaId: embeddedData.waba_id,
            phoneNumberId: embeddedData.phone_number_id,
          });
          setStatus({ connected: true, phoneNumberId: res.data.phoneNumberId });
          toast.success("WhatsApp conectado!");
          onConnected?.(res.data);
        } catch (err) {
          toast.error(err.response?.data?.error || "Falha ao conectar o WhatsApp.");
        } finally {
          setLoading(false);
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
      }
    );
  }

  if (!APP_ID || !CONFIG_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Conexão automática indisponível — integração Meta ainda não configurada no
        servidor.
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="rounded-lg border border-verde-200 bg-verde-50 p-3 text-sm text-verde-900">
        <strong>WhatsApp conectado</strong>
        {status.phoneNumberId ? ` (número #${status.phoneNumberId})` : ""}.
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={loading || !sdkReady}
      className="rounded-lg bg-verde px-4 py-2.5 font-semibold text-white hover:bg-verde-600 disabled:opacity-60"
    >
      {loading ? "Conectando..." : "Conectar WhatsApp"}
    </button>
  );
}
