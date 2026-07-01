// Níveis de alerta do paciente — usados no cadastro, edição e exibição.
// Mantém cor/label/descrição num único lugar.
export const ALERT_LEVELS = {
  none: {
    value: "none",
    label: "Sem alerta",
    short: "Sem alerta",
    // estilos do chip seletor
    chip: "border-gray-200 text-gray-500",
    chipActive: "border-gray-400 bg-gray-100 text-gray-700 ring-2 ring-gray-300",
    // estilos do banner de exibição
    banner: "",
    dot: "bg-gray-300",
  },
  low: {
    value: "low",
    label: "Atenção leve",
    short: "Atenção",
    chip: "border-amber-200 text-amber-600",
    chipActive: "border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-300",
    banner: "bg-amber-50 border-amber-300 text-amber-800",
    dot: "bg-amber-400",
  },
  medium: {
    value: "medium",
    label: "Cuidado",
    short: "Cuidado",
    chip: "border-orange-200 text-orange-600",
    chipActive: "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-300",
    banner: "bg-orange-50 border-orange-300 text-orange-800",
    dot: "bg-orange-500",
  },
  high: {
    value: "high",
    label: "Alerta grave",
    short: "Alerta grave",
    chip: "border-red-200 text-red-600",
    chipActive: "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-300",
    banner: "bg-red-50 border-red-400 text-red-800",
    dot: "bg-red-500",
  },
};

export const ALERT_ORDER = ["none", "low", "medium", "high"];

export function getAlertLevel(value) {
  return ALERT_LEVELS[value] || ALERT_LEVELS.none;
}
