import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      toast.success("Senha redefinida! Agora é só entrar.");
      // Não logamos automaticamente: quem redefine a senha entra com ela,
      // e assim confirma que guardou a senha nova.
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Não conseguimos redefinir sua senha agora.");
    } finally {
      setSaving(false);
    }
  }

  // Link truncado no cliente de e-mail, ou aberto na mão sem o token.
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-creme-50 px-4">
        <div className="bg-white rounded-2xl border border-creme-100 shadow-sm w-full max-w-md p-8">
          <h1 className="text-xl font-bold text-verde mb-1">Link inválido</h1>
          <p className="text-sm text-gray-500 mb-6">
            Este link está incompleto ou expirou. Peça um novo e-mail de redefinição.
          </p>
          <Link to="/esqueci-senha"
            className="block text-center w-full bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-3 rounded-xl transition">
            Pedir novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme-50 px-4">
      <div className="bg-white rounded-2xl border border-creme-100 shadow-sm w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-verde mb-1">Crie sua nova senha</h1>
        <p className="text-sm text-gray-500 mb-6">
          Escolha uma senha com pelo menos 6 caracteres. Dessa vez, guarde num lugar seguro.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Nova senha</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Confirme a nova senha</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {saving ? "Salvando…" : "Redefinir senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
