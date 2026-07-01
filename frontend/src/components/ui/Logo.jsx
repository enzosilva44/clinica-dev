/**
 * Logo — símbolo oficial "Iaso" (o arco) + wordmark opcional.
 * Fonte: Identidade / Brand Book (arco que acolhe e eleva + nó âmbar).
 *
 * Props:
 *   variant: "color" (verde) | "mono" (currentColor) | "rev" (creme, p/ fundo escuro)
 *   size:    px do símbolo (default 30)
 *   wordmark: mostra "IasoClin" ao lado (default false)
 *   wordmarkColor: "auto" (verde) | "white" — cor do "Iaso" na wordmark
 *   className: aplicado ao wrapper
 */
const FILLS = {
  color: { arc: "#00704A", knot: "#A9DEC8" },
  mono:  { arc: "currentColor", knot: "currentColor" },
  rev:   { arc: "#FAF7F2", knot: "#A9DEC8" },
};

export function LogoMark({ variant = "color", size = 30, className = "" }) {
  const f = FILLS[variant] || FILLS.color;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="Iaso">
      <path
        d="M70.66 22.5 A36 36 0 1 1 29.34 22.5 L37.4 34 A22 22 0 1 0 62.6 34 Z"
        fill={f.arc}
      />
      <circle cx="50" cy="16" r="7.5" fill={f.knot} />
    </svg>
  );
}

export default function Logo({
  variant = "color",
  size = 30,
  wordmark = false,
  wordmarkColor = "auto",
  className = "",
}) {
  const isoColor = wordmarkColor === "white" ? "#FFFFFF" : "#00704A";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark variant={variant} size={size} />
      {wordmark && (
        <span className="font-light text-xl tracking-wide" style={{ letterSpacing: ".02em" }}>
          <span style={{ color: isoColor, fontWeight: 300 }}>Iaso</span>
          <span style={{ color: "#00704A", fontWeight: 600 }}>Clin</span>
        </span>
      )}
    </span>
  );
}
