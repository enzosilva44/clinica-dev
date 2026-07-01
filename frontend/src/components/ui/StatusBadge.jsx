/**
 * StatusBadge — linguagem de status do DS (cor + rótulo, nunca só cor).
 * status: confirmado | agendado | pendente | cancelado | concluido
 *         pago | sucesso | info | atencao | erro
 * Ou passe cores custom via props {bg,fg,dot,label}.
 */
const MAP = {
  confirmado: { bg: "#D4E9E2", fg: "#006241", dot: "#3A9B6F", label: "Confirmado" },
  pago:       { bg: "#D4E9E2", fg: "#006241", dot: "#3A9B6F", label: "Pago" },
  sucesso:    { bg: "#D4E9E2", fg: "#006241", dot: "#3A9B6F", label: "Sucesso" },
  agendado:   { bg: "#EAF1F7", fg: "#3E6E97", dot: "#4A8EC2", label: "Agendado" },
  info:       { bg: "#EAF1F7", fg: "#3E6E97", dot: "#4A8EC2", label: "Info" },
  pendente:   { bg: "#FAF0E4", fg: "#A86E43", dot: "#C4895A", label: "Pendente" },
  atencao:    { bg: "#FAF0E4", fg: "#A86E43", dot: "#C4895A", label: "Atenção" },
  cancelado:  { bg: "#FBEDEC", fg: "#C2473C", dot: "#E2574C", label: "Cancelado" },
  erro:       { bg: "#FBEDEC", fg: "#C2473C", dot: "#E2574C", label: "Erro" },
  concluido:  { bg: "#EDEAE5", fg: "#7c756a", dot: "#a99e8f", label: "Concluído" },
};

export default function StatusBadge({ status, label, className = "", ...props }) {
  const s = MAP[status] || MAP.info;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-semibold ${className}`}
      style={{ background: s.bg, color: s.fg }}
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {label || s.label}
    </span>
  );
}
