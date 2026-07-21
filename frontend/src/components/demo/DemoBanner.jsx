import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

// Calcula o tempo restante da demo uma única vez (fora do render puro).
function computeRestante(demoExpiresAt) {
  if (!demoExpiresAt) return null;
  const ms = new Date(demoExpiresAt) - Date.now();
  if (ms <= 0) return null;
  const horas = Math.ceil(ms / (1000 * 60 * 60));
  return horas <= 1 ? "menos de 1h" : `~${horas}h`;
}

// Barra fixa exibida quando a conta logada é uma demonstração temporária.
// CTA "Quero contratar de verdade" leva ao wizard de contratação (/contratar).
export default function DemoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tempo restante aproximado, calculado uma vez no mount.
  const [restante] = useState(() => computeRestante(user?.demoExpiresAt));

  if (user?.plan !== "demo") return null;

  return (
    <div className="w-full bg-verde text-white">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={15} className="shrink-0 text-ambar" />
          <span>
            Você está numa <strong>demonstração</strong>
            {restante ? <> — os dados de teste somem em {restante}.</> : <> — os dados de teste serão apagados.</>}
          </span>
        </div>
        <button
          onClick={() => navigate("/contratar")}
          className="bg-white text-verde px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-creme-50 transition flex items-center gap-1.5"
        >
          Quero contratar de verdade <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
