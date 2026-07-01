import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";

export default function TrocarSenha() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
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
      await api.patch("/profile/password", { currentPassword, newPassword });
      updateUser({ mustChangePassword: false });
      toast.success("Senha redefinida com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao redefinir a senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme-50 px-4">
      <div className="bg-white rounded-2xl border border-creme-100 shadow-sm w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-verde mb-1">Defina sua nova senha</h1>
        <p className="text-sm text-gray-500 mb-6">
          {user?.name ? `Olá, ${user.name}! ` : ""}
          Por segurança, você precisa criar uma senha pessoal antes de usar o sistema.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Senha atual (a que você recebeu)</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Nova senha</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Confirme a nova senha</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-verde/20" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {saving ? "Salvando…" : "Redefinir senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
