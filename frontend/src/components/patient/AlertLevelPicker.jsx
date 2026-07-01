import { AlertTriangle } from "lucide-react";
import { ALERT_ORDER, getAlertLevel } from "./alertLevels";

// Seletor de nível de alerta do paciente (chips clicáveis).
// value: "none" | "low" | "medium" | "high"
export default function AlertLevelPicker({ value = "none", onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className="text-verde" />
        <span className="text-xs font-bold text-verde uppercase tracking-wide">
          Nível de alerta
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALERT_ORDER.map((key) => {
          const lvl = getAlertLevel(key);
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                active ? lvl.chipActive : lvl.chip
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${lvl.dot}`} />
              {lvl.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Quando definido, aparece em destaque no topo do prontuário do paciente.
      </p>
    </div>
  );
}
