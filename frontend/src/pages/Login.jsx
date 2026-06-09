import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Shield, Sparkles, MessageSquare, Map, FileSignature, BarChart2, CalendarCheck, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

function IasoLogo({ size = "md" }) {
  const s = size === "sm" ? { svg: "w-8 h-12", stroke: 2.5 } : { svg: "w-14 h-20", stroke: 3.5 };
  return (
    <svg viewBox="0 0 56 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={s.svg}>
      <line x1="14" y1="7"  x2="42" y2="7"  stroke="#C2A56B" strokeWidth={s.stroke} strokeLinecap="round" />
      <line x1="28" y1="7"  x2="28" y2="73" stroke="#C2A56B" strokeWidth={s.stroke} strokeLinecap="round" />
      <line x1="14" y1="73" x2="42" y2="73" stroke="#C2A56B" strokeWidth={s.stroke} strokeLinecap="round" />
      <path d="M28 32 Q34 24 42 20" stroke="#C2A56B" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M28 32 Q40 14 44 12 Q46 22 38 28 Q34 31 28 32 Z" fill="#C2A56B" opacity="0.85" />
    </svg>
  );
}

const FEATURES = [
  { icon: CalendarCheck, label: "Agenda Inteligente",        desc: "Gestão completa de agendamentos com visão semanal e mensal" },
  { icon: Map,           label: "Mapa de Procedimentos",     desc: "Mapeamento facial com anatomia muscular e registro por sessão" },
  { icon: FileSignature, label: "Assinatura Eletrônica",     desc: "Fluxo avançado com OTP por e-mail, geolocalização e auditoria" },
  { icon: MessageSquare, label: "Automações WhatsApp",       desc: "Confirmações, lembretes e aniversários via Meta Cloud API" },
  { icon: Sparkles,      label: "IA Clínica",                desc: "Resumos de pacientes, rascunhos de evolução e análise financeira" },
  { icon: Package,       label: "Estoque & Financeiro",      desc: "Controle de insumos, fluxo de caixa e alertas de estoque baixo" },
  { icon: Shield,        label: "Documentos Digitais",       desc: "Pasta sanitária, contratos e termos com hash SHA-256" },
  { icon: BarChart2,     label: "Relatórios & Analytics",    desc: "Indicadores de performance, tickets médios e tendências" },
];

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const googleButtonRef    = useRef(null);
  const googleRenderedRef  = useRef(false);

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch {
      toast.error("E-mail ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButtonRef.current) return;

    function renderGoogleButton() {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      if (googleRenderedRef.current) return;
      googleButtonRef.current.innerHTML = "";
      googleRenderedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try { await loginWithGoogle(response.credential); }
          catch { toast.error("Erro ao entrar com Google"); }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 220,
      });
    }

    if (window.google?.accounts?.id) { renderGoogleButton(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);
  }, [loginWithGoogle]);

  const INPUT = "w-full border border-[#D8CDB9] bg-[#FDFCFA] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1F4D46]/20 focus:border-[#1F4D46] transition";

  return (
    <div className="min-h-screen bg-[#F5F1EA] flex flex-col lg:flex-row">

      {/* ── PAINEL ESQUERDO — Brand + Features ── */}
      <div className="lg:w-[55%] bg-[#1F4D46] flex flex-col px-10 py-12 lg:px-16 lg:py-16">

        {/* Logo */}
        <div className="flex items-center gap-4 mb-12">
          <IasoLogo />
          <div>
            <p className="text-2xl font-bold tracking-wide">
              <span className="text-white">Iaso</span><span className="text-[#C2A56B]">Clin</span>
            </p>
            <p className="text-[#D8CDB9]/70 text-xs mt-0.5">Sistema de Gestão Clínica</p>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
            Gestão completa para<br />
            <span className="text-[#C2A56B]">clínicas de estética</span>
          </h1>
          <p className="text-[#D8CDB9]/80 text-sm leading-relaxed max-w-md">
            Do agendamento à assinatura eletrônica, do mapa facial à análise financeira —
            tudo integrado com Inteligência Artificial.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 bg-white/5 hover:bg-white/10 transition rounded-2xl px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl bg-[#C2A56B]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={15} className="text-[#C2A56B]" />
              </div>
              <div>
                <p className="text-white text-xs font-semibold leading-tight">{label}</p>
                <p className="text-[#D8CDB9]/60 text-[11px] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[#D8CDB9]/30 text-[11px] mt-auto pt-10">
          © {new Date().getFullYear()} IasoClin · Todos os direitos reservados
        </p>
      </div>

      {/* ── PAINEL DIREITO — Login ── */}
      <div className="lg:w-[45%] flex items-center justify-center px-8 py-12 lg:px-14">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <IasoLogo size="sm" />
            <p className="text-xl font-bold">
              <span className="text-[#1F4D46]">Iaso</span><span className="text-[#C2A56B]">Clin</span>
            </p>
          </div>

          <h2 className="text-2xl font-bold text-[#1F4D46] mb-1">Bem-vindo(a)!</h2>
          <p className="text-sm text-gray-400 mb-8">Acesse sua conta para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={INPUT + " pr-11"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-xs text-gray-400 hover:text-[#1F4D46] transition">
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1F4D46] hover:bg-[#285A50] disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-[#D8CDB9] flex-1" />
                <span className="text-xs text-gray-400">ou continue com</span>
                <div className="h-px bg-[#D8CDB9] flex-1" />
              </div>
              <div className="flex justify-center gap-3">
                <div ref={googleButtonRef} />
                <button
                  type="button"
                  onClick={() => toast("Login com Apple em breve")}
                  className="w-11 h-11 rounded-xl border border-[#D8CDB9] bg-white hover:bg-[#F5F1EA] flex items-center justify-center transition"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-gray-700">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.39.07 2.35.74 3.15.8 1.19-.24 2.33-.93 3.62-.84 1.53.12 2.68.72 3.43 1.84-3.14 1.88-2.4 5.97.55 7.13-.65 1.59-1.47 3.14-2.75 3.93zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                </button>
              </div>
            </>
          )}

          <p className="text-center text-[11px] text-gray-300 mt-10">
            Versão Beta · IasoClin
          </p>
        </div>
      </div>
    </div>
  );
}
