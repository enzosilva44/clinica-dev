import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, ClipboardList, X } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button, Spinner } from "../components/ui";
import api from "../services/api";
import toast from "react-hot-toast";

const TYPE_LABELS = {
  text: "Resposta aberta",
  boolean: "Sim / Não",
  choice: "Múltipla escolha",
};

const TYPE_BADGE = {
  text: "bg-info/10 text-info",
  boolean: "bg-verde-100 text-verde-800",
  choice: "bg-ambar/15 text-ambar-700",
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

  if (loading) return <MainLayout><Spinner /></MainLayout>;

  /* ─── EDITOR ─── */
  if (editing) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-serif font-light text-3xl text-verde-900">
              {editing.id ? "Editar modelo" : "Novo modelo de anamnese"}
            </h1>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition">
              <X size={15} /> Cancelar
            </button>
          </div>

          <input
            value={editing.name}
            onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nome do modelo (ex: Anamnese Facial)"
            className="w-full border border-creme-200 rounded-xl px-4 py-3 text-sm mb-5 bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
          />

          <div className="space-y-3">
            {editing.questions.map((q, idx) => (
              <Card key={q.id} className="bg-creme-50! p-4">
                <div className="flex items-start gap-2">
                  <GripVertical size={16} className="text-gray-300 mt-2.5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <input
                      value={q.label}
                      onChange={(e) => setQ(idx, { label: e.target.value })}
                      placeholder={`Pergunta ${idx + 1}`}
                      className="w-full border border-creme-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={q.type}
                        onChange={(e) => setQ(idx, { type: e.target.value })}
                        className="border border-creme-200 rounded-lg px-2 py-1.5 text-xs bg-white text-verde-900"
                      >
                        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input type="checkbox" checked={!!q.required} onChange={(e) => setQ(idx, { required: e.target.checked })} />
                        Obrigatória
                      </label>
                      <button onClick={() => removeQ(idx)} className="ml-auto text-erro/70 hover:text-erro transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {q.type === "choice" && (
                      <input
                        value={(q.options || []).join(", ")}
                        onChange={(e) => setQ(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Opções separadas por vírgula (ex: Leve, Moderado, Grave)"
                        className="w-full border border-creme-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <button onClick={addQ} className="mt-3 flex items-center gap-1.5 text-sm text-verde font-semibold hover:underline">
            <Plus size={15} /> Adicionar pergunta
          </button>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" size="md" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="md" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar modelo"}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  /* ─── LISTA ─── */
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif font-light text-3xl text-verde-900">Anamneses (Modelos)</h1>
            <p className="text-gray-500 mt-1">Crie e edite os formulários usados nos pacientes.</p>
          </div>
          <Button size="md" onClick={startNew}>
            <Plus size={16} /> Novo modelo
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
              <ClipboardList size={28} className="text-ambar" />
            </div>
            <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum modelo cadastrado</h2>
            <p className="text-gray-500 mb-6 max-w-xs">Crie o primeiro modelo de anamnese para usar nos pacientes.</p>
            <Button onClick={startNew}>
              <Plus size={16} /> Novo modelo
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((t) => {
              const questionCount = (t.questions || []).length;
              const types = [...new Set((t.questions || []).map((q) => q.type))];
              return (
                <Card
                  key={t.id}
                  className="p-4.5 cursor-pointer hover:border-verde transition"
                  onClick={() => startEdit(t)}
                >
                  <div className="flex justify-between items-start gap-3 mb-2.5">
                    <div>
                      <p className="text-[15px] font-bold text-verde-900">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {questionCount} {questionCount === 1 ? "pergunta" : "perguntas"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEdit(t)}
                        className="bg-creme-50 border border-creme-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-500 hover:border-verde hover:text-verde transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="bg-creme-50 border border-creme-200 rounded-lg px-2.5 py-1.5 text-erro/70 hover:border-erro hover:text-erro transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((type) => (
                        <span
                          key={type}
                          className={`rounded-md px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide ${TYPE_BADGE[type] || "bg-creme-100 text-gray-500"}`}
                        >
                          {TYPE_LABELS[type] || type}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
