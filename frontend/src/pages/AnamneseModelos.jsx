import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const TYPE_LABELS = {
  text: "Resposta aberta",
  boolean: "Sim / Não",
  choice: "Múltipla escolha",
};

function newQuestion() {
  return { id: `q${Date.now()}${Math.floor(Math.random() * 1000)}`, label: "", type: "boolean", options: [], required: false };
}

export default function AnamneseModelos() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id?, name, questions }
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/anamnesis/templates");
      setTemplates(res.data);
    } catch { toast.error("Erro ao carregar modelos"); }
    finally { setLoading(false); }
  }

  function startNew() {
    setEditing({ name: "", questions: [newQuestion()] });
  }
  function startEdit(t) {
    setEditing({ id: t.id, name: t.name, questions: t.questions || [] });
  }

  function setQ(idx, patch) {
    setEditing((prev) => {
      const questions = prev.questions.map((q, i) => i === idx ? { ...q, ...patch } : q);
      return { ...prev, questions };
    });
  }
  function addQ() { setEditing((prev) => ({ ...prev, questions: [...prev.questions, newQuestion()] })); }
  function removeQ(idx) { setEditing((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) })); }

  async function save() {
    if (!editing.name.trim()) { toast.error("Dê um nome ao modelo."); return; }
    if (editing.questions.some((q) => !q.label.trim())) { toast.error("Todas as perguntas precisam de um texto."); return; }
    setSaving(true);
    try {
      const payload = { name: editing.name, questions: editing.questions };
      if (editing.id) await api.put(`/anamnesis/templates/${editing.id}`, payload);
      else await api.post("/anamnesis/templates", payload);
      toast.success("Modelo salvo!");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm("Excluir este modelo? As anamneses já preenchidas continuam válidas.")) return;
    try {
      await api.delete(`/anamnesis/templates/${id}`);
      toast.success("Modelo excluído");
      load();
    } catch { toast.error("Erro ao excluir"); }
  }

  if (loading) return <div className="p-8 text-gray-400">Carregando…</div>;

  /* ─── EDITOR ─── */
  if (editing) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-[#00704A]">{editing.id ? "Editar modelo" : "Novo modelo de anamnese"}</h1>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-gray-600">✕ Cancelar</button>
        </div>

        <input
          value={editing.name}
          onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
          placeholder="Nome do modelo (ex: Anamnese Facial)"
          className="w-full border border-[#DDD8CC] rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
        />

        <div className="space-y-3">
          {editing.questions.map((q, idx) => (
            <div key={q.id} className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-xl p-4">
              <div className="flex items-start gap-2">
                <GripVertical size={16} className="text-gray-300 mt-2.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <input
                    value={q.label}
                    onChange={(e) => setQ(idx, { label: e.target.value })}
                    placeholder={`Pergunta ${idx + 1}`}
                    className="w-full border border-[#DDD8CC] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={q.type}
                      onChange={(e) => setQ(idx, { type: e.target.value })}
                      className="border border-[#DDD8CC] rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <input type="checkbox" checked={!!q.required} onChange={(e) => setQ(idx, { required: e.target.checked })} />
                      Obrigatória
                    </label>
                    <button onClick={() => removeQ(idx)} className="ml-auto text-red-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {q.type === "choice" && (
                    <input
                      value={(q.options || []).join(", ")}
                      onChange={(e) => setQ(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Opções separadas por vírgula (ex: Leve, Moderado, Grave)"
                      className="w-full border border-[#DDD8CC] rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addQ} className="mt-3 flex items-center gap-1.5 text-sm text-[#00704A] font-medium hover:underline">
          <Plus size={15} /> Adicionar pergunta
        </button>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setEditing(null)} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-[#F2F0EB] transition">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="bg-[#00704A] hover:bg-[#1E3932] text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar modelo"}
          </button>
        </div>
      </div>
    );
  }

  /* ─── LISTA ─── */
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#00704A]">Modelos de Anamnese</h1>
          <p className="text-sm text-gray-400">Crie e edite os formulários usados nos pacientes.</p>
        </div>
        <button onClick={startNew}
          className="bg-[#00704A] hover:bg-[#1E3932] text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + Novo modelo
        </button>
      </div>

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border border-[#E6E2D8] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#141414]">{t.name}</p>
              <p className="text-[11px] text-gray-400">{(t.questions || []).length} perguntas</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => startEdit(t)} className="text-xs text-[#00704A] font-medium hover:underline">Editar</button>
              <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
