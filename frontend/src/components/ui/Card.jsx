/**
 * Card — superfície padrão do DS.
 * elevation: sutil | card | elevado | flutuante  (default card)
 * Uso: <Card className="p-6">...</Card>
 */
const ELEV = {
  sutil: "shadow-sutil",
  card: "shadow-card",
  elevado: "shadow-elevado",
  flutuante: "shadow-flutuante",
};

export default function Card({ elevation = "card", className = "", children, ...props }) {
  return (
    <div
      className={`bg-white border border-creme-200 rounded-xl ${ELEV[elevation] || ELEV.card} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
