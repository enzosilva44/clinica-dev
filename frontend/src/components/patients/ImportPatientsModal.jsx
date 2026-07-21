import { useRef, useState, useMemo } from "react";
import {
  X, Upload, FileSpreadsheet, CheckCircle, AlertCircle,
  ChevronDown, AlertTriangle, RefreshCw, Users, XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "../../services/api";
import { mensagemDeErro } from "../../lib/tomDeVoz";

// ── Error helper ──────────────────────────────────────────────────────────────

// Traduz erros da API no tom de voz Iaso (ver lib/tomDeVoz). Um 401 aqui não é
// problema do CSV: a sessão caiu e o usuário só precisa entrar de novo.
function friendlyError(err, acao) {
  if (err?.response?.status === 401) {
    return "Sua sessão expirou. Entre de novo e a gente continua a importação de onde parou.";
  }
  return mensagemDeErro(err, acao);
}

// ── Column mapping ────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  name: "Nome", phone: "Telefone", email: "E-mail", birthDate: "Nascimento",
  cpf: "CPF", rg: "RG", street: "Endereço", city: "Cidade",
  state: "UF", zipCode: "CEP", observations: "Observações",
};

const FIELD_ALIASES = {
  name:         ["nome", "name", "paciente", "cliente"],
  phone:        ["telefone", "celular", "tel", "fone", "phone", "whatsapp", "contato"],
  email:        ["email", "e-mail", "correio", "mail"],
  birthDate:    ["data de nascimento", "nascimento", "data nasc", "dt nasc", "birthdate", "dob", "aniversario"],
  cpf:          ["cpf", "documento", "doc"],
  rg:           ["rg"],
  street:       ["rua", "endereco", "endereço", "logradouro", "street"],
  city:         ["cidade", "city", "municipio"],
  state:        ["estado", "uf", "state"],
  zipCode:      ["cep", "zipcode", "zip"],
  observations: ["observacoes", "observações", "obs", "notas", "anotacoes", "notes"],
};

function normalize(str) {
  return String(str ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function autoDetectMapping(headers) {
  const mapping = {};
  headers.forEach((header) => {
    const norm = normalize(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some((a) => norm.includes(a) || a.includes(norm))) {
        if (!mapping[field]) mapping[field] = header;
      }
    }
  });
  return mapping;
}

function parseDateBR(val) {
  if (!val) return null;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d+$/.test(str)) {
    try {
      const d = XLSX.SSF.parse_date_code(Number(str));
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  return null;
}

function applyMapping(rows, mapping) {
  return rows.map((row) => {
    const p = {};
    for (const [field, col] of Object.entries(mapping)) {
      if (col && col !== "__none__") p[field] = row[col] != null ? String(row[col]) : null;
    }
    if (p.birthDate) p.birthDate = parseDateBR(p.birthDate);
    return p;
  }).filter((p) => p.name?.trim());
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  new:            { label: "Novo",                color: "text-green-600",  bg: "bg-green-50  border-green-100",  icon: CheckCircle,   defaultSelected: true  },
  similar:        { label: "Possível duplicata",  color: "text-amber-600",  bg: "bg-amber-50  border-amber-100",  icon: AlertTriangle, defaultSelected: false },
  exists:         { label: "Já existe no sistema",color: "text-red-500",    bg: "bg-red-50    border-red-100",    icon: XCircle,       defaultSelected: false },
  duplicate_file: { label: "Repetido no arquivo", color: "text-gray-400",   bg: "bg-gray-50   border-gray-200",   icon: RefreshCw,     defaultSelected: false },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportPatientsModal({ onClose, onSuccess }) {
  const fileRef = useRef();
  const [step, setStep] = useState("upload"); // upload | checking | review | importing | done
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [showMapping, setShowMapping] = useState(false);
  const [checkedRows, setCheckedRows] = useState([]);   // enriched rows from backend
  const [selected, setSelected] = useState(new Set());  // _idx values
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFile(file) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: true, defval: "" });
        if (json.length === 0) { setError("O arquivo está vazio."); return; }
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawRows(json);
        setMapping(autoDetectMapping(hdrs));
        setStep("upload"); // keep on upload so user sees mapping before checking
      } catch {
        setError("Não foi possível ler o arquivo. Verifique se é um XLS, XLSX ou CSV válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const parsedPatients = useMemo(() => applyMapping(rawRows, mapping), [rawRows, mapping]);

  // ── Check against DB ───────────────────────────────────────────────────────

  async function runCheck() {
    if (parsedPatients.length === 0) return;
    setStep("checking");
    setError(null);
    try {
      const res = await api.post("/patients/import/check", { patients: parsedPatients });
      const rows = res.data;
      setCheckedRows(rows);
      // default selection: only "new" rows
      const sel = new Set(rows.filter((r) => STATUS_CONFIG[r.status]?.defaultSelected).map((r) => r._idx));
      setSelected(sel);
      setStep("review");
    } catch (err) {
      setError(friendlyError(err, "verificar os pacientes"));
      setStep("upload");
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  function toggleRow(idx) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  }

  function toggleGroup(status) {
    const group = checkedRows.filter((r) => r.status === status).map((r) => r._idx);
    const allOn = group.every((i) => selected.has(i));
    setSelected((s) => {
      const n = new Set(s);
      group.forEach((i) => (allOn ? n.delete(i) : n.add(i)));
      return n;
    });
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function doImport() {
    const toImport = checkedRows
      .filter((r) => selected.has(r._idx))
      .map(({ _idx, status, _matchedWith, _duplicateOf, ...p }) => p);

    if (toImport.length === 0) return;
    setStep("importing");
    try {
      const res = await api.post("/patients/import", { patients: toImport });
      setResult(res.data);
      setStep("done");
    } catch (err) {
      setResult({ error: friendlyError(err, "importar os pacientes") });
      setStep("done");
    }
  }

  // ── Grouped counts ─────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    const g = { new: [], similar: [], exists: [], duplicate_file: [] };
    checkedRows.forEach((r) => g[r.status]?.push(r));
    return g;
  }, [checkedRows]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-creme-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet size={15} className="text-verde" />
            </div>
            <h2 className="text-base font-bold text-verde">Importar Pacientes</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-1.5 px-6 pt-4 pb-0">
          {[["upload","1. Arquivo"], ["review","2. Revisão"], ["done","3. Resultado"]].map(([s, label], i) => {
            const active = step === s || (step === "checking" && s === "upload") || (step === "importing" && s === "review");
            const done = (s === "upload" && ["review","importing","done"].includes(step)) ||
                         (s === "review" && ["importing","done"].includes(step));
            return (
              <div key={s} className="flex items-center gap-1.5">
                {i > 0 && <div className={`h-px w-6 ${done ? "bg-verde" : "bg-gray-200"}`} />}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition ${
                  active ? "bg-verde text-white" : done ? "text-verde" : "text-gray-400"
                }`}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* ── UPLOAD ── */}
          {(step === "upload" || step === "checking") && (
            <>
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => !rawRows.length && fileRef.current.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition ${
                  rawRows.length ? "cursor-default border-verde/30 bg-[#F0F7F5]"
                  : dragOver ? "cursor-pointer border-verde bg-[#F0F7F5]"
                  : "cursor-pointer border-creme-200 hover:border-verde hover:bg-creme-50"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                />
                {rawRows.length > 0 ? (
                  <>
                    <CheckCircle size={28} className="text-verde mb-2" />
                    <p className="text-sm font-semibold text-verde">
                      {parsedPatients.length} paciente{parsedPatients.length !== 1 ? "s" : ""} encontrado{parsedPatients.length !== 1 ? "s" : ""}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline transition"
                    >
                      Trocar arquivo
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-creme-100 rounded-2xl flex items-center justify-center mb-3">
                      <Upload size={20} className="text-verde" />
                    </div>
                    <p className="text-sm font-semibold text-verde mb-1">Arraste ou clique para selecionar</p>
                    <p className="text-xs text-gray-400">.xlsx · .xls · .csv</p>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Mapping panel */}
              {rawRows.length > 0 && (
                <div className="border border-creme-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowMapping((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-creme-50 hover:bg-creme-100 transition text-left"
                  >
                    <span className="text-sm font-semibold text-verde">Mapeamento de colunas</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${showMapping ? "rotate-180" : ""}`} />
                  </button>
                  {showMapping && (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {Object.entries(FIELD_LABELS).map(([field, label]) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500">{label}</label>
                          <select
                            value={mapping[field] || "__none__"}
                            onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                            className="border border-creme-200 rounded-lg px-2.5 py-1.5 text-xs text-verde bg-white focus:outline-none"
                          >
                            <option value="__none__">— Ignorar —</option>
                            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── CHECKING ── */}
          {step === "checking" && (
            <div className="flex items-center justify-center gap-3 py-6">
              <RefreshCw size={18} className="text-verde animate-spin" />
              <p className="text-sm text-verde font-medium">Verificando duplicatas…</p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {(step === "review" || step === "importing") && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={status} className={`rounded-xl border px-3 py-2.5 text-center ${cfg.bg}`}>
                      <Icon size={18} className={`mx-auto mb-1 ${cfg.color}`} />
                      <p className={`text-lg font-bold leading-none ${cfg.color}`}>{groups[status].length}</p>
                      <p className="text-[10px] text-gray-500 mt-1 leading-tight">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 text-center">
                Selecione os pacientes que deseja importar.{" "}
                <span className="font-semibold text-verde">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
              </p>

              {/* Groups */}
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
                const rows = groups[status];
                if (rows.length === 0) return null;
                const allOn = rows.every((r) => selected.has(r._idx));
                const Icon = cfg.icon;
                return (
                  <div key={status} className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={cfg.color} />
                        <span className={`text-xs font-semibold ${cfg.color}`}>
                          {cfg.label} ({rows.length})
                        </span>
                      </div>
                      <button
                        onClick={() => toggleGroup(status)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition underline"
                      >
                        {allOn ? "Desmarcar todos" : "Marcar todos"}
                      </button>
                    </div>
                    <div className="bg-white divide-y divide-gray-100">
                      {rows.map((row) => (
                        <label
                          key={row._idx}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(row._idx)}
                            onChange={() => toggleRow(row._idx)}
                            className="accent-verde w-3.5 h-3.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-verde truncate">{row.name || "—"}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {row.phone || "sem telefone"}
                              {row.cpf ? ` · CPF ${row.cpf}` : ""}
                            </p>
                          </div>
                          {row._matchedWith && (
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-gray-400">já existe como</p>
                              <p className="text-xs text-gray-500 font-medium truncate max-w-32">{row._matchedWith.name}</p>
                            </div>
                          )}
                          {row._duplicateOf !== undefined && (
                            <span className="text-[10px] text-gray-400 shrink-0">repetido</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === "importing" && (
            <div className="flex items-center justify-center gap-3 py-4">
              <RefreshCw size={18} className="text-verde animate-spin" />
              <p className="text-sm text-verde font-medium">Importando {selected.size} paciente{selected.size !== 1 ? "s" : ""}…</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {result?.error ? (
                <>
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                    <AlertCircle size={26} className="text-red-500" />
                  </div>
                  <p className="text-base font-bold text-gray-800 mb-1">Erro na importação</p>
                  <p className="text-sm text-gray-500">{result.error}</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                    <CheckCircle size={26} className="text-green-500" />
                  </div>
                  <p className="text-base font-bold text-verde mb-1">Importação concluída!</p>
                  <p className="text-sm text-gray-500 mb-4">
                    <span className="font-semibold text-verde">{result.created}</span>{" "}
                    paciente{result.created !== 1 ? "s" : ""} importado{result.created !== 1 ? "s" : ""}
                    {result.skipped > 0 && ` · ${result.skipped} ignorado${result.skipped !== 1 ? "s" : ""}`}
                  </p>
                  {result.errors?.length > 0 && (
                    <div className="w-full text-left bg-red-50 border border-red-100 rounded-xl p-3 mt-2">
                      <p className="text-xs font-semibold text-red-600 mb-1">Erros ({result.errors.length}):</p>
                      {result.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-red-500">{e.name}: {e.error}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
          <div>
            {step === "review" && (
              <button
                onClick={() => { setStep("upload"); setCheckedRows([]); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition"
              >
                ← Voltar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "done" ? (
              <button
                onClick={() => { onSuccess?.(); onClose(); }}
                className="bg-verde hover:bg-verde-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
              >
                Concluir
              </button>
            ) : step === "review" ? (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button
                  onClick={doImport}
                  disabled={selected.size === 0}
                  className="bg-verde hover:bg-verde-900 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                >
                  Importar {selected.size > 0 ? `${selected.size} paciente${selected.size !== 1 ? "s" : ""}` : ""}
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition">
                  Cancelar
                </button>
                {rawRows.length > 0 && step !== "checking" && (
                  <button
                    onClick={runCheck}
                    className="bg-verde hover:bg-verde-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
                  >
                    <Users size={14} />
                    Verificar {parsedPatients.length} registro{parsedPatients.length !== 1 ? "s" : ""}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
