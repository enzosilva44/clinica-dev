import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const googleButtonRef = useRef(null);
  const googleRenderedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  async function handleLogin(e) {
    e.preventDefault();

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      console.error(error);

      toast.error("Email ou senha inválidos");
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
          try {
            await loginWithGoogle(response.credential);
          } catch (error) {
            console.error(error);
            toast.error("Erro ao entrar com Google");
          }
        },
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: googleButtonRef.current.offsetWidth,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);
  }, [loginWithGoogle]);

  return (
  <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
    <div className="bg-[#FAF7F2] border border-[#E5D8C5] p-8 rounded-2xl shadow-lg w-full max-w-md">
      <h1 className="text-3xl font-bold text-center mb-2 text-[#314D3E]">
        Iasoclin
      </h1>

      <p className="text-center text-sm text-gray-600 mb-6">
        Acesse sua clínica
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          className="w-full border border-[#D6C1A3] rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
        />

        <input
          type="password"
          className="w-full border border-[#D6C1A3] rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-[#314D3E] hover:bg-[#4D6B59] text-white p-3 rounded-lg transition font-medium"
        >
          Entrar
        </button>
      </form>

      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-[#E5D8C5] flex-1" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="h-px bg-[#E5D8C5] flex-1" />
          </div>

          <div ref={googleButtonRef} className="w-full flex justify-center" />
        </>
      )}
    </div>
  </div>
  );
}
