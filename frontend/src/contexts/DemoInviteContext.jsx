import { createContext, useContext, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PartyPopper, ArrowRight, X } from "lucide-react";
import { useAuth } from "./AuthContext";

const DemoInviteContext = createContext({ maybeInvite: () => {} });

// Mostra um convite POSITIVO para contratar após ações-chave na demo.
// Não é intrusivo: aparece na 1ª ação relevante e depois só a cada N ações,
// com cooldown de tempo, para não irritar.
const EVERY_N = 3;               // dispara na 1ª e a cada 3 ações
const COOLDOWN_MS = 90 * 1000;   // no mínimo 90s entre convites

export function DemoInviteProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const countRef = useRef(0);
  const lastShownRef = useRef(0);

  const isDemo = user?.plan === "demo";

  // Chamar após uma ação relevante (criar paciente, agendamento, etc.).
  // `context` personaliza a frase (ex: "esse paciente", "esse agendamento").
  const maybeInvite = useCallback((context) => {
    if (!isDemo) return;
    countRef.current += 1;
    const now = Date.now();
    const firstTime = lastShownRef.current === 0;
    const dueByCount = firstTime || countRef.current % EVERY_N === 0;
    const dueByTime = now - lastShownRef.current > COOLDOWN_MS;
    if (!dueByCount || !dueByTime) return;

    lastShownRef.current = now;
    setMessage(
      context
        ? `Gostou de organizar ${context}? Contrate e leve tudo pra sua clínica de verdade.`
        : "Gostou do que viu? Contrate e leve tudo pra sua clínica de verdade."
    );
    setOpen(true);
  }, [isDemo]);

  return (
    <DemoInviteContext.Provider value={{ maybeInvite }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center relative">
            <button onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition" aria-label="Fechar">
              <X size={18} />
            </button>
            <div className="w-14 h-14 rounded-full bg-verde/10 flex items-center justify-center mx-auto mb-4">
              <PartyPopper size={26} className="text-verde" />
            </div>
            <h2 className="text-lg font-black text-[#141414] mb-2">{message}</h2>
            <p className="text-sm text-gray-500 mb-6">
              14 dias grátis, sem compromisso. Seus dados param de ser temporários e ficam salvos de verdade.
            </p>
            <button onClick={() => { setOpen(false); navigate("/contratar"); }}
              className="w-full bg-verde hover:bg-verde-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 mb-2">
              Contratar agora <ArrowRight size={15} />
            </button>
            <button onClick={() => setOpen(false)}
              className="w-full text-gray-400 text-sm hover:text-gray-600 transition py-1">
              Continuar explorando
            </button>
          </div>
        </div>
      )}
    </DemoInviteContext.Provider>
  );
}

export function useDemoInvite() {
  return useContext(DemoInviteContext);
}
