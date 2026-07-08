import { Search, Sparkles, Plus } from "lucide-react";

// UI mobile de Pacientes — fiel ao protótipo Iasoclin Mobile.
// Recebe dados/handlers por props do componente pai (Patients.jsx); não
// duplica lógica de negócio (loads/estado vivem no pai).

function initials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function relativeDate(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "há 1 dia";
  if (diff < 30) return `há ${diff} dias`;
  if (diff < 365) {
    const mo = Math.floor(diff / 30);
    return `há ${mo} ${mo === 1 ? "mês" : "meses"}`;
  }
  const y = Math.floor(diff / 365);
  return `há ${y} ${y === 1 ? "ano" : "anos"}`;
}

// Faixas de recência — verde ≤30d, âmbar 30-90d, vermelho >90d/nunca.
function recencyColor(date) {
  if (!date) return "#C2473C";
  const diff = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (diff <= 30) return "#3A9B6F";
  if (diff <= 90) return "#C4895A";
  return "#C2473C";
}

// Paletas de avatar alternadas por índice.
const AVATARS = [
  { bg: "#D4E9E2", text: "#006241" },
  { bg: "#FAF0E4", text: "#A86E43" },
  { bg: "#EAF1F7", text: "#3E6E97" },
];

export default function PatientsMobile({
  patients = [],
  search,
  setSearch,
  status,
  setStatus,
  sortBy,
  setSortBy,
  total,
  onOpenPatient,
  onCreate,
  onSuggestions,
}) {
  return (
    <div className="min-h-full bg-[#FAF7F2]" style={{ padding: "20px 18px 96px" }}>
      {/* header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-serif font-light text-[26px] text-[#0A3326] m-0">Pacientes</h1>
        <button
          onClick={onSuggestions}
          className="rounded-[10px] px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5"
          style={{ background: "#F3EEFB", border: "1px solid #DCCBF5", color: "#7C53C9" }}
        >
          <Sparkles size={13} /> Sugestões IA
        </button>
      </div>

      {/* busca */}
      <div
        className="flex items-center gap-2.5 bg-white rounded-[13px] mb-3"
        style={{ border: "1.5px solid #E5D8C5", padding: "11px 14px" }}
      >
        <Search size={17} style={{ color: "#9aa69e" }} className="flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, telefone ou CPF…"
          className="flex-1 bg-transparent outline-none text-sm text-[#0A3326] placeholder:text-[#9aa69e]"
        />
      </div>

      {/* chips de status */}
      <div className="flex items-center gap-2 mb-4">
        {[["active", "Ativos"], ["removed", "Inativos"]].map(([v, l]) => {
          const on = status === v;
          return (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className="rounded-full text-[11.5px]"
              style={
                on
                  ? { background: "#00704A", color: "#fff", fontWeight: 700, padding: "6px 14px" }
                  : { background: "#fff", border: "1px solid #ECE2D2", color: "#6f7d74", padding: "6px 14px" }
              }
            >
              {l}
            </button>
          );
        })}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="ml-auto rounded-full text-[11.5px] bg-white outline-none"
          style={{ border: "1px solid #ECE2D2", color: "#6f7d74", padding: "6px 10px" }}
          aria-label="Ordenar"
        >
          <option value="name_asc">A–Z</option>
          <option value="name_desc">Z–A</option>
          <option value="recent">Recentes</option>
          <option value="oldest">Antigos</option>
        </select>
      </div>
      <div className="text-[11.5px] mb-4 -mt-2" style={{ color: "#9aa69e" }}>
        {total} pacientes
      </div>

      {/* lista */}
      {patients.length === 0 ? (
        <div className="text-center text-[#9aa69e] text-sm py-16">
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {patients.map((p, i) => {
            const av = AVATARS[i % AVATARS.length];
            const age = calcAge(p.birthDate);
            const rel = relativeDate(p.lastAppointment);
            const sub = [p.phone, age != null ? `${age} anos` : null].filter(Boolean).join(" · ");
            return (
              <button
                key={p.id}
                onClick={() => onOpenPatient(p.id)}
                className="w-full text-left flex items-center gap-3 bg-white rounded-[14px]"
                style={{ border: "1px solid #ECE2D2", padding: "13px 14px" }}
              >
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold"
                  style={{ width: 42, height: 42, background: av.bg, color: av.text }}
                >
                  {initials(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[14px] text-[#0A3326] truncate">{p.name}</div>
                  {sub && (
                    <div className="text-[11.5px] truncate" style={{ color: "#6f7d74" }}>
                      {sub}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <span
                    className="rounded-full"
                    style={{ width: 8, height: 8, background: recencyColor(p.lastAppointment) }}
                  />
                  {rel && (
                    <span className="text-[11.5px]" style={{ color: "#9aa69e" }}>
                      {rel}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FAB novo paciente */}
      <button
        onClick={onCreate}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#00704A] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,112,74,.4)] z-30"
        aria-label="Novo paciente"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
