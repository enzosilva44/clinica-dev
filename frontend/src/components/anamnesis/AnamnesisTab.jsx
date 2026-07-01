import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function AnamnesisTab({ patientId }) {
  const [templates, setTemplates] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(null); // { template, responseId, answers }
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => { load(); }, [patientId]);

  async function load() {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        api.get("/anamnesis/templates"),
        api.get(`/anamnesis/responses/patient/${patientId}`),
      ]);
      setTemplates(t.data);
      setResponses(r.data);
    } catch {
      toast.error("Erro ao carregar anamneses");
    } finally {
      setLoading(false);
    }
  }

  function startFilling(template, existing = null) {
    setFilling({
      template,
      responseId: existing?.id ?? null,
      answers: existing?.answers ?? {},
    });
  }

  // auto-save com debounce
  function setAnswer(qId, value) {
    setFilling((prev) => {
      const next = { ...prev, answers: { ...prev.answers, [qId]: value } };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => autoSave(next), 1200);
      return next;
    });
  }

  async function autoSave(state) {
    try {
      const res = await api.post("/anamnesis/responses", {
        templateId: state.template.id,
        patientId,
        answers: state.answers,
        responseId: state.responseId,
      });
      setFilling((prev) => (prev ? { ...prev, responseId: res.data.id } : prev));
    } catch { /* silencioso no auto-save */ }
  }

  async function finalize() {
    if (!filling) return;
    setSaving(true);
    try {
      let responseId = filling.responseId;
      if (!responseId) {
        const res = await api.post("/anamnesis/responses", {
          templateId: filling.template.id, patientId, answers: filling.answers,
        });
        responseId = res.data.id;
      }
      await api.post(`/anamnesis/responses/${responseId}/finalize`, { answers: filling.answers });
      toast.success("Anamnese finalizada! PDF anexado nos documentos do paciente.");
      setFilling(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao finalizar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">Carregando…</div>;

  /* ─── MODO PREENCHIMENTO ─── */
  if (filling) {
    const qs = filling.template.questions || [];
    return (
      <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#00704A]">Preencher Anamnese</h2>
          <button onClick={() => setFilling(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Fechar</button>
        </div>
        <p className="text-xs text-amber-600 mb-5">Rascunho salvo automaticamente</p>

        <div className="space-y-3">
          {qs.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-4">
              <label className="text-sm font-semibold text-[#141414]">
                {i + 1}. {q.label} {q.required && <span className="text-red-500">*</span>}
              </label>
              <div className="w-56 shrink-0">
                {q.type === "text" && (
                  <input
                    value={filling.answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder="Resposta…"
                    className="w-full border border-[#E5D8C5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                  />
                )}
                {q.type === "boolean" && (
                  <select
                    value={filling.answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full border border-[#E5D8C5] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                  >
                    <option value="">Selecione…</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                )}
                {q.type === "choice" && (
                  <select
                    value={filling.answers[q.id] ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full border border-[#E5D8C5] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00704A]/20"
                  >
                    <option value="">Selecione…</option>
                    {(q.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => setFilling(null)} className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-white transition">Cancelar</button>
          <button onClick={finalize} disabled={saving}
            className="bg-[#00704A] hover:bg-[#0A3326] text-white text-sm font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50">
            {saving ? "Finalizando…" : "Finalizar e gerar PDF"}
          </button>
        </div>
      </div>
    );
  }

  /* ─── LISTA ─── */
  return (
    <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-[#00704A]">Anamneses</h2>
        <div className="flex gap-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => startFilling(t)}
              className="bg-[#00704A] hover:bg-[#0A3326] text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
              + {t.name}
            </button>
          ))}
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Nenhuma anamnese preenchida ainda.</p>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => (
            <div key={r.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#141414]">{r.template?.name || "Anamnese"}</p>
                <p className="text-[11px] text-gray-400">
                  {r.status === "finalized"
                    ? `Finalizada em ${new Date(r.finalizedAt).toLocaleDateString("pt-BR")}`
                    : "Rascunho"}
                </p>
              </div>
              {r.status === "finalized" ? (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">PDF gerado</span>
              ) : (
                <button onClick={() => startFilling(r.template ? { id: r.templateId, name: r.template.name, questions: r.template.questions } : null, r)}
                  className="text-xs text-[#00704A] font-medium hover:underline">
                  Continuar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
