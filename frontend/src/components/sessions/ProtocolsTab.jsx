import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Package, X, Layers } from "lucide-react";
import { Card, Button, SearchableSelect } from "../ui";
import api from "../../services/api";
import toast from "react-hot-toast";

const BRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function emptyProcedure() {
  return { procedureId: "", procedureName: "", unitPrice: 0, quantity: 1, products: [] };
}

function emptySession() {
  return { label: "", procedures: [emptyProcedure()] };
}

function emptyForm() {
  return {
    name: "",
    description: "",
    useFixedPrice: false,
    fixedPrice: 0,
    sessions: [emptySession()],
  };
}

// Soma dos procedimentos de todas as sessões.
function sessionsSum(sessions) {
  return sessions.reduce(
    (s, sess) =>
      s +
      sess.procedures.reduce(
        (acc, p) => acc + (Number(p.unitPrice) || 0) * (Number(p.quantity) || 1),
        0,
      ),
    0,
  );
}

export default function ProtocolsTab() {
  const [protocols, setProtocols] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    try {
      const [p, procs, prods] = await Promise.all([
        api.get("/protocols"),
        api.get("/procedures"),
        api.get("/products").catch(() => ({ data: [] })),
      ]);
      setProtocols(p.data);
      setProcedures(procs.data.filter((x) => x.isActive !== false));
      setProducts(prods.data || []);
    } catch {
      toast.error("Erro ao carregar protocolos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const procedureOptions = useMemo(
    () => procedures.map((p) => ({ value: p.id, label: p.name })),
    [procedures],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function openEdit(protocol) {
    setEditingId(protocol.id);
    setForm({
      name: protocol.name,
      description: protocol.description || "",
      useFixedPrice: protocol.useFixedPrice,
      fixedPrice: protocol.fixedPrice || 0,
      sessions: (protocol.sessions || []).map((s) => ({
        label: s.label || "",
        procedures: (s.procedures || []).map((pp) => ({
          procedureId: pp.procedureId || "",
          procedureName: pp.procedureName,
          unitPrice: pp.unitPrice,
          quantity: pp.quantity,
          products: (pp.products || []).map((prod) => ({
            productId: prod.productId || "",
            customName: prod.customName || "",
            quantity: prod.quantity,
          })),
        })),
      })),
    });
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
  }

  // Atualiza um procedimento dentro de uma sessão (imutável).
  function patchProcedure(sIdx, pIdx, patch) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions.map((s, i) =>
        i === sIdx
          ? { ...s, procedures: s.procedures.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) }
          : s,
      ),
    }));
  }

  // Ao selecionar procedimento, puxa nome + preço + materiais do cadastro.
  function selectProcedure(sIdx, pIdx, procedureId) {
    const proc = procedures.find((p) => p.id === procedureId);
    patchProcedure(sIdx, pIdx, {
      procedureId,
      procedureName: proc?.name || "",
      unitPrice: proc?.price ?? 0,
      products: (proc?.products || []).map((pp) => ({
        productId: pp.product?.id || pp.productId || "",
        customName: pp.product?.name || pp.customName || "",
        quantity: pp.quantity ?? 1,
      })),
    });
  }

  function addProcedure(sIdx) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions.map((s, i) =>
        i === sIdx ? { ...s, procedures: [...s.procedures, emptyProcedure()] } : s,
      ),
    }));
  }

  function removeProcedure(sIdx, pIdx) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions.map((s, i) =>
        i === sIdx ? { ...s, procedures: s.procedures.filter((_, j) => j !== pIdx) } : s,
      ),
    }));
  }

  function addSession() {
    setForm((f) => ({ ...f, sessions: [...f.sessions, emptySession()] }));
  }

  // Duplica a última sessão (comum: várias sessões iguais).
  function duplicateSession(sIdx) {
    setForm((f) => {
      const clone = JSON.parse(JSON.stringify(f.sessions[sIdx]));
      const sessions = [...f.sessions];
      sessions.splice(sIdx + 1, 0, clone);
      return { ...f, sessions };
    });
  }

  function removeSession(sIdx) {
    setForm((f) => ({ ...f, sessions: f.sessions.filter((_, i) => i !== sIdx) }));
  }

  function setSessionLabel(sIdx, label) {
    setForm((f) => ({
      ...f,
      sessions: f.sessions.map((s, i) => (i === sIdx ? { ...s, label } : s)),
    }));
  }

  // Produtos de um procedimento.
  function selectProduct(sIdx, pIdx, prodIdx, productId) {
    const product = products.find((x) => x.id === productId);
    patchProcedure(sIdx, pIdx, {
      products: form.sessions[sIdx].procedures[pIdx].products.map((pr, j) =>
        j === prodIdx ? { ...pr, productId, customName: product?.name || pr.customName } : pr,
      ),
    });
  }
  function patchProduct(sIdx, pIdx, prodIdx, patch) {
    patchProcedure(sIdx, pIdx, {
      products: form.sessions[sIdx].procedures[pIdx].products.map((pr, j) =>
        j === prodIdx ? { ...pr, ...patch } : pr,
      ),
    });
  }
  function addProduct(sIdx, pIdx) {
    patchProcedure(sIdx, pIdx, {
      products: [...form.sessions[sIdx].procedures[pIdx].products, { productId: "", customName: "", quantity: 1 }],
    });
  }
  function removeProduct(sIdx, pIdx, prodIdx) {
    patchProcedure(sIdx, pIdx, {
      products: form.sessions[sIdx].procedures[pIdx].products.filter((_, j) => j !== prodIdx),
    });
  }

  async function save() {
    if (saving) return;
    if (!form.name.trim()) return toast.error("Dê um nome ao protocolo");
    const validSessions = form.sessions
      .map((s) => ({ ...s, procedures: s.procedures.filter((p) => p.procedureName?.trim()) }))
      .filter((s) => s.procedures.length > 0);
    if (validSessions.length === 0) return toast.error("Adicione ao menos uma sessão com um procedimento");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      useFixedPrice: form.useFixedPrice,
      fixedPrice: form.useFixedPrice ? Number(form.fixedPrice) || 0 : null,
      sessions: validSessions.map((s) => ({
        label: s.label?.trim() || null,
        procedures: s.procedures.map((p) => ({
          procedureId: p.procedureId || null,
          procedureName: p.procedureName.trim(),
          unitPrice: Number(p.unitPrice) || 0,
          quantity: Math.max(Number(p.quantity) || 1, 1),
          products: p.products
            .filter((pr) => pr.productId || pr.customName?.trim())
            .map((pr) => ({
              productId: pr.productId || null,
              customName: pr.customName?.trim() || null,
              quantity: Number(pr.quantity) || 0,
            })),
        })),
      })),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/protocols/${editingId}`, payload);
        toast.success("Protocolo atualizado");
      } else {
        await api.post("/protocols", payload);
        toast.success("Protocolo criado");
      }
      closeForm();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao salvar protocolo");
    } finally {
      setSaving(false);
    }
  }

  async function remove(protocol) {
    if (!confirm(`Remover o protocolo "${protocol.name}"? Orçamentos já criados não são afetados.`)) return;
    try {
      await api.delete(`/protocols/${protocol.id}`);
      toast.success("Protocolo removido");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Erro ao remover");
    }
  }

  const formSum = form ? sessionsSum(form.sessions) : 0;
  const formTotal = form ? (form.useFixedPrice ? Number(form.fixedPrice) || 0 : formSum) : 0;

  if (loading) {
    return <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>;
  }

  return (
    <div>
      {!form && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate} className="inline-flex items-center gap-1.5">
            <Plus size={16} /> Novo protocolo
          </Button>
        </div>
      )}

      {form && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-verde-900 text-lg">
              {editingId ? "Editar protocolo" : "Novo protocolo"}
            </h3>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome do protocolo (ex.: Protocolo Facial Completo)"
            className="w-full px-3 py-2.5 rounded-xl border border-creme-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-verde/30"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descrição (opcional)"
            className="w-full px-3 py-2.5 rounded-xl border border-creme-200 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-verde/30"
          />

          {/* Cards de sessão */}
          <div className="flex flex-col gap-4 mb-4">
            {form.sessions.map((session, sIdx) => {
              const sessTotal = session.procedures.reduce(
                (acc, p) => acc + (Number(p.unitPrice) || 0) * (Number(p.quantity) || 1),
                0,
              );
              return (
                <div key={sIdx} className="rounded-xl border-2 border-creme-200 p-4 bg-creme-50/50">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-verde text-white text-xs font-bold shrink-0">
                        {sIdx + 1}
                      </span>
                      <input
                        value={session.label}
                        onChange={(e) => setSessionLabel(sIdx, e.target.value)}
                        placeholder={`Sessão ${sIdx + 1} (rótulo opcional)`}
                        className="text-sm font-semibold text-verde-900 bg-transparent border-b border-transparent focus:border-verde/40 focus:outline-none min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-semibold text-verde-900 mr-1">{BRL(sessTotal)}</span>
                      <button
                        onClick={() => duplicateSession(sIdx)}
                        className="text-gray-400 hover:text-verde p-1"
                        title="Duplicar sessão"
                      >
                        <Layers size={15} />
                      </button>
                      {form.sessions.length > 1 && (
                        <button
                          onClick={() => removeSession(sIdx)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Remover sessão"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Procedimentos da sessão */}
                  <div className="flex flex-col gap-3">
                    {session.procedures.map((proc, pIdx) => (
                      <div key={pIdx} className="rounded-lg border border-creme-200 bg-white p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1">
                            <SearchableSelect
                              value={proc.procedureId}
                              onChange={(id) => selectProcedure(sIdx, pIdx, id)}
                              options={procedureOptions}
                              placeholder="Selecione o procedimento…"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={proc.unitPrice}
                              onChange={(e) => patchProcedure(sIdx, pIdx, { unitPrice: e.target.value })}
                              className="w-24 px-2.5 py-2.5 rounded-xl border border-creme-200 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30"
                            />
                          </div>
                          {session.procedures.length > 1 && (
                            <button
                              onClick={() => removeProcedure(sIdx, pIdx)}
                              className="text-gray-400 hover:text-red-500 mt-2.5"
                              title="Remover procedimento"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        {/* Materiais */}
                        <div className="pl-1">
                          <p className="text-[11px] font-medium text-gray-400 mb-1.5">
                            Materiais estimados (baixa real na evolução)
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {proc.products.map((prod, prodIdx) => (
                              <div key={prodIdx} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <SearchableSelect
                                    value={prod.productId}
                                    onChange={(id) => selectProduct(sIdx, pIdx, prodIdx, id)}
                                    options={productOptions}
                                    placeholder="Material…"
                                  />
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={prod.quantity}
                                  onChange={(e) => patchProduct(sIdx, pIdx, prodIdx, { quantity: e.target.value })}
                                  className="w-20 px-2.5 py-2 rounded-lg border border-creme-200 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30"
                                  placeholder="Qtd"
                                />
                                <button
                                  onClick={() => removeProduct(sIdx, pIdx, prodIdx)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addProduct(sIdx, pIdx)}
                              className="text-xs text-verde hover:underline self-start mt-0.5"
                            >
                              + material
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addProcedure(sIdx)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-verde hover:underline self-start"
                    >
                      <Plus size={13} /> Adicionar procedimento
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addSession}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-verde hover:underline mb-5"
          >
            <Plus size={15} /> Adicionar sessão
          </button>

          {/* Preço */}
          <div className="rounded-xl bg-creme-50 p-3.5 mb-5">
            <label className="flex items-center gap-2 text-sm text-verde-900 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useFixedPrice}
                onChange={(e) => setForm((f) => ({ ...f, useFixedPrice: e.target.checked }))}
                className="accent-verde"
              />
              Usar preço fechado do pacote
            </label>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-gray-500">
                {form.sessions.length} sessão{form.sessions.length > 1 ? "es" : ""} · soma dos
                procedimentos: <b className="text-verde-900">{BRL(formSum)}</b>
              </span>
              {form.useFixedPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Preço fechado R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.fixedPrice}
                    onChange={(e) => setForm((f) => ({ ...f, fixedPrice: e.target.value }))}
                    className="w-28 px-2.5 py-2 rounded-lg border border-creme-200 text-sm focus:outline-none focus:ring-2 focus:ring-verde/30"
                  />
                </div>
              )}
              <span className="text-sm font-semibold text-verde-900">Total: {BRL(formTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={closeForm}
              disabled={saving}
              className="text-sm text-gray-600 px-4 py-2 rounded-xl hover:bg-creme-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar protocolo"}
            </Button>
          </div>
        </Card>
      )}

      {/* Lista */}
      {protocols.length === 0 && !form ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-creme-100 flex items-center justify-center mb-3">
            <Package className="text-verde/60" size={26} />
          </div>
          <h2 className="text-lg font-semibold text-verde-900 mb-1">Nenhum protocolo</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Crie protocolos reutilizáveis (sessões com procedimentos + materiais) para
            pré-preencher orçamentos com um clique.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {protocols.map((p) => {
            const procCount = (p.sessions || []).reduce((s, sess) => s + sess.procedures.length, 0);
            return (
              <Card key={p.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-verde-900 truncate">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-gray-500 truncate">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-verde p-1" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remove(p)} className="text-gray-400 hover:text-red-500 p-1" title="Remover">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {(p.sessions || []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-verde/15 text-verde-900 font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-gray-600 truncate">
                        {s.procedures.map((pp) => pp.procedureName).join(", ") || "—"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-creme-200 pt-2.5 mt-0.5">
                  <span>
                    <b className="text-verde-900">{p.sessionCount}</b> sessão{p.sessionCount > 1 ? "es" : ""} · {procCount} procedimento{procCount > 1 ? "s" : ""}
                  </span>
                  <span className="text-sm font-semibold text-verde-900">{BRL(p.total)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
