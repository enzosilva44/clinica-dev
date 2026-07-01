/**
 * Input — campo do DS: rótulo visível, foco verde, mensagem de erro.
 * Uso: <Input label="Nome do paciente" value={..} onChange={..} error="..." />
 */
export default function Input({ label, error, className = "", id, ...props }) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[12.5px] font-semibold mb-[7px]"
          style={{ color: error ? "#C2473C" : "#3a473f" }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className="w-full box-border rounded-[11px] px-3.5 py-[11px] text-sm font-sans outline-none transition-colors"
        style={{
          border: `1.5px solid ${error ? "var(--erro)" : "var(--creme-200)"}`,
          background: error ? "#FCF3F2" : "var(--creme-50)",
          color: "var(--verde-900)",
        }}
        onFocus={(e) => { if (!error) { e.target.style.borderColor = "var(--verde)"; e.target.style.background = "#fff"; } }}
        onBlur={(e) => { if (!error) { e.target.style.borderColor = "var(--creme-200)"; e.target.style.background = "var(--creme-50)"; } }}
        {...props}
      />
      {error && (
        <div className="flex items-center gap-1.5 text-[11.5px] mt-1.5" style={{ color: "#C2473C" }}>
          {error}
        </div>
      )}
    </div>
  );
}
