/**
 * Button — variantes do Design System Iasoclin (Verde Vibrante).
 * variant: primary | secondary | accent | ghost | destructive
 * size:    sm | md | lg
 * Uso: <Button variant="primary" size="md" onClick={...}>Agendar</Button>
 */
const VARIANTS = {
  primary:
    "bg-verde text-white shadow-[0_4px_14px_rgba(0,112,74,.22)] hover:bg-verde-900 hover:-translate-y-px",
  secondary:
    "bg-white text-verde border-[1.5px] border-verde hover:bg-verde hover:text-white",
  accent:
    "bg-ambar text-white shadow-[0_4px_14px_rgba(196,137,90,.28)] hover:bg-ambar-600",
  ghost:
    "bg-transparent text-verde hover:bg-verde-50",
  destructive:
    "bg-white text-erro border-[1.5px] border-[#EBCBC7] hover:bg-erro hover:text-white hover:border-erro",
};

const SIZES = {
  sm: "px-3.5 py-1.5 text-[12.5px] rounded-[9px]",
  md: "px-[22px] py-3 text-sm rounded-xl",
  lg: "px-[26px] py-3.5 text-[15.5px] rounded-[13px]",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-bold font-sans cursor-pointer transition-all duration-200 border-0";
  const disabledCls = disabled
    ? "!bg-creme-100 !text-[#bcae9a] !shadow-none !cursor-not-allowed !translate-y-0 !border-0"
    : "";
  return (
    <button
      disabled={disabled}
      className={`${base} ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${disabledCls} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
