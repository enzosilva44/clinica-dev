import { useEffect, useMemo, useRef, useState } from "react";

/**
 * SearchableSelect — select com busca por digitação e opções em ordem alfabética.
 * Uso: <SearchableSelect value={id} onChange={(id) => ...} options={[{value, label}]} placeholder="Selecione..." />
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  label,
  error,
  className = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [options]
  );

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return sortedOptions;
    const q = query.trim().toLowerCase();
    return sortedOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [sortedOptions, query]);

  const selected = sortedOptions.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function selectOption(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label
          className="block text-[12.5px] font-semibold mb-[7px]"
          style={{ color: error ? "#C2473C" : "#3a473f" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className="w-full text-left border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20 flex items-center justify-between gap-2 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className={selected ? "" : "text-gray-400"}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-20 mt-1.5 w-full bg-white border border-creme-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-creme-200">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full border border-creme-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-verde"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filteredOptions.length === 0 && (
                <div className="px-3 py-2.5 text-sm text-gray-400">Nenhum resultado</div>
              )}
              {filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectOption(opt)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-creme-50 transition ${
                    opt.value === value ? "bg-verde/10 text-verde-900 font-medium" : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-[11.5px] mt-1.5" style={{ color: "#C2473C" }}>
          {error}
        </div>
      )}
    </div>
  );
}
