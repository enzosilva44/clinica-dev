/**
 * Toggle — switch on/off do DS (verde quando ativo).
 * Uso: <Toggle checked={on} onChange={setOn} />
 */
export default function Toggle({ checked = false, onChange, className = "", ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange && onChange(!checked)}
      className={`relative w-[46px] h-[26px] rounded-full cursor-pointer transition-colors border-0 ${className}`}
      style={{ background: checked ? "#00704A" : "#D6C1A3" }}
      {...props}
    >
      <span
        className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-all"
        style={{ left: checked ? "23px" : "3px" }}
      />
    </button>
  );
}
