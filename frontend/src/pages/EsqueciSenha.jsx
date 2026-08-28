import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail para continuar.");
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      // A resposta é sempre a mesma, exista a conta ou não — a tela reflete isso
      // e não confirma se o e-mail está cadastrado.
      setEnviado(true);
      toast.success(data?.message || "E-mail enviado!");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Não conseguimos enviar o e-mail agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme-50 px-4">
      <div className="bg-white rounded-2xl border border-creme-100 shadow-sm w-full max-w-md p-8">
        {enviado ? (
          <>
            <h1 className="text-xl font-bold text-verde mb-1">Verifique seu e-mail</h1>
            <p className="text-sm text-gray-500 mb-6">
              Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.
              O link vale por <strong>1 hora</strong>. Não esqueça de olhar o spam.
            </p>
            <Link to="/login"
              className="block text-center w-full bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-3 rounded-xl transition">
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-verde mb-1">Esqueceu sua senha?</h1>
            <p className="text-sm text-gray-500 mb-6">
              Sem problema. Digite o e-mail da sua conta e enviamos um link para você criar uma nova.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-3 rounded-xl transition disabled:opacity-50">
                {sending ? "Enviando…" : "Enviar link de redefinição"}
              </button>
            </form>
            <Link to="/login" className="block text-center text-xs text-gray-400 hover:text-verde transition mt-5">
              Voltar para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
