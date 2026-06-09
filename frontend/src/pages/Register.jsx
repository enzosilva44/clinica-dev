import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

function IasoLogo() {
  return (
    <svg viewBox="0 0 56 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-14">
      <line x1="14" y1="7"  x2="42" y2="7"  stroke="#C2A56B" strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="7"  x2="28" y2="73" stroke="#C2A56B" strokeWidth="3" strokeLinecap="round" />
      <line x1="14" y1="73" x2="42" y2="73" stroke="#C2A56B" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 32 Q34 24 42 20" stroke="#C2A56B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M28 32 Q40 14 44 12 Q46 22 38 28 Q34 31 28 32 Z" fill="#C2A56B" opacity="0.85" />
    </svg>
  );
}

const INPUT = "w-full border border-[#D8CDB9] bg-[#FDFCFA] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1F4D46]/20 focus:border-[#1F4D46] transition";

export default function Register() {
  const navigate    = useNavigate();
  const { login }   = useAuth();

  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { toast.error("As senhas não coincidem"); return; }
    if (password.length < 6)  { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), password });
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F1EA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl px-8 py-10">

        <div className="flex items-center gap-3 mb-8 justify-center">
          <IasoLogo />
          <p className="text-xl font-bold">
            <span className="text-[#1F4D46]">Iaso</span><span className="text-[#C2A56B]">Clin</span>
          </p>
        </div>

        <h2 className="text-2xl font-bold text-[#1F4D46] mb-1">Criar conta</h2>
        <p className="text-sm text-gray-400 mb-7">Preencha os dados para começar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dra. Ana Silva"
              required
              className={INPUT}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              required
              className={INPUT}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Senha</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className={INPUT + " pr-11"}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Confirmar senha</label>
            <input
              type={showPass ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              required
              className={INPUT}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1F4D46] hover:bg-[#285A50] disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition mt-2"
          >
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Já tem conta?{" "}
          <Link to="/" className="text-[#1F4D46] font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
