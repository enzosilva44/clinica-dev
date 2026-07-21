import { useEffect, useState } from "react";
import { Pencil, Trash2, Copy, Plus, X, Stethoscope, Search, LayoutGrid, List } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import { Button } from "../components/ui";
import api from "../services/api";

export default function Procedures() {
  const [procedures, setProcedures] = useState([]);
  const [originFilter, setOriginFilter] = useState("todos"); // todos | padrao | meus
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("procedures:viewMode") || "card"); // card | lista
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState(null);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Outros");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [hasMultipleSessions, setHasMultipleSessions] = useState(false);
  const [requiresReturn, setRequiresReturn] = useState(false);
  const [returnDays, setReturnDays] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([
    { productId: "", customName: "", quantity: 1, perSession: true },
  ]);

  async function loadProcedures() {
    try {
      const response = await api.get("/procedures");
      setProcedures(response.data);
    } catch (error) {
      console.error(error);
      toast.error(mensagemDeErro(error, "carregar os procedimentos"));
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const response = await api.get("/products");
      setProducts(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function saveProcedure() {
    try {
      const payload = {
        name,
        description,
        category,
        duration: duration ? Number(duration) : null,
        price: price ? Number(price) : null,
        hasMultipleSessions,
        requiresReturn,
        returnDays: returnDays ? Number(returnDays) : null,
        products: selectedProducts,
      };

      if (editingProcedure) {
        await api.put(`/procedures/${editingProcedure.id}`, payload);
        toast.success("Procedimento atualizado!");
      } else {
        await api.post("/procedures", payload);
        toast.success("Procedimento criado!");
      }

      resetForm();
      setShowModal(false);
      loadProcedures();
    } catch (error) {
      console.error(error);
      toast.error(mensagemDeErro(error, "salvar o procedimento"));
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/procedures/${procedureToDelete.id}`);
      setShowDeleteModal(false);
      setProcedureToDelete(null);
      toast.success("Procedimento excluído");
      loadProcedures();
    } catch (error) {
      console.error(error);
      toast.error(mensagemDeErro(error, "excluir o procedimento"));
    }
  }

  function handleEdit(procedure) {
    setEditingProcedure(procedure);
    setName(procedure.name || "");
    setDescription(procedure.description || "");
    setCategory(procedure.category || "Outros");
    setDuration(procedure.duration || "");
    setPrice(procedure.price || "");
    setHasMultipleSessions(procedure.hasMultipleSessions || false);
    setRequiresReturn(procedure.requiresReturn || false);
    setReturnDays(procedure.returnDays || "");
    setSelectedProducts(
      procedure.products?.length
        ? procedure.products.map((item) => ({
            productId: item.productId || "",
            customName: item.customName || "",
            quantity: item.quantity || 1,
            perSession: item.perSession || false,
          }))
        : [{ productId: "", customName: "", quantity: 1, perSession: true }]
    );
    setShowModal(true);
  }

  function handleDuplicate(procedure) {
    setEditingProcedure(null);
    setName(`${procedure.name} - Cópia`);
    setDescription(procedure.description || "");
    setCategory(procedure.category || "Outros");
    setDuration(procedure.duration || "");
    setPrice(procedure.price || "");
    setHasMultipleSessions(procedure.hasMultipleSessions || false);
    setRequiresReturn(procedure.requiresReturn || false);
    setReturnDays(procedure.returnDays || "");
    setSelectedProducts(
      procedure.products?.length
        ? procedure.products.map((item) => ({
            productId: item.productId || "",
            customName: item.customName || "",
            quantity: item.quantity || 1,
            perSession: item.perSession || false,
          }))
        : [{ productId: "", customName: "", quantity: 1, perSession: true }]
    );
    setShowModal(true);
  }

  function resetForm() {
    setEditingProcedure(null);
    setName("");
    setDescription("");
    setCategory("Outros");
    setDuration("");
    setPrice("");
    setHasMultipleSessions(false);
    setRequiresReturn(false);
    setReturnDays("");
    setSelectedProducts([{ productId: "", customName: "", quantity: 1, perSession: true }]);
  }

  function addProduct() {
    setSelectedProducts([
      ...selectedProducts,
      { productId: "", customName: "", quantity: 1, perSession: true },
    ]);
  }

  function updateProduct(index, field, value) {
    const updated = [...selectedProducts];
    updated[index][field] = value;
    setSelectedProducts(updated);
  }

  function removeProduct(index) {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  }

  useEffect(() => {
    loadProcedures();
    loadProducts();
  }, []);

  const hasDefaults = procedures.some((p) => p.isDefault);
  const q = search.trim().toLowerCase();
  const visibleProcedures = procedures
    .filter((p) => {
      if (originFilter === "padrao") return p.isDefault;
      if (originFilter === "meus") return !p.isDefault;
      return true;
    })
    .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
    .sort((a, b) =>
      sortBy === "name_desc"
        ? (b.name || "").localeCompare(a.name || "", "pt-BR")
        : (a.name || "").localeCompare(b.name || "", "pt-BR")
    );

  const FILTER_TABS = [
    { key: "todos",  label: "Todos" },
    { key: "padrao", label: "Padrão" },
    { key: "meus",   label: "Meus" },
  ];

  const INPUT_CLASS =
    "w-full border border-creme-200 bg-creme-50 rounded-xl p-3 text-sm outline-none focus:border-verde focus:bg-white transition-colors";

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Procedimentos</h1>
          <p className="text-gray-500 mt-1">
            {visibleProcedures.length} procedimento{visibleProcedures.length !== 1 ? "s" : ""}
            {originFilter === "padrao" ? " padrão" : originFilter === "meus" ? " criado por você" : " cadastrado" + (visibleProcedures.length !== 1 ? "s" : "")}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasDefaults && (
            <div className="flex gap-1 bg-creme-100 rounded-xl p-0.75">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOriginFilter(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-[12.5px] font-bold transition ${
                    originFilter === t.key
                      ? "bg-white text-verde shadow-sm"
                      : "text-gray-500 hover:text-verde"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <Button size="md" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} /> Novo procedimento
          </Button>
        </div>
      </div>

      {/* BUSCA + ORDEM */}
      {procedures.length > 0 && (
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar procedimento por nome…"
              className="w-full pl-10 pr-4 py-2.5 border border-ambar rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-ambar rounded-xl px-3 py-2.5 text-sm bg-white text-verde focus:outline-none focus:ring-2 focus:ring-verde/20 cursor-pointer"
            aria-label="Ordenar procedimentos"
          >
            <option value="name_asc">Nome (A–Z)</option>
            <option value="name_desc">Nome (Z–A)</option>
          </select>
          {/* TOGGLE CARD / LISTA */}
          <div className="flex border border-ambar rounded-xl overflow-hidden bg-white shrink-0">
            {[
              { key: "card", icon: LayoutGrid, label: "Cards" },
              { key: "lista", icon: List, label: "Lista" },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => { setViewMode(key); localStorage.setItem("procedures:viewMode", key); }}
                aria-pressed={viewMode === key}
                title={`Ver em ${label.toLowerCase()}`}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition ${
                  viewMode === key ? "bg-verde-50 text-verde font-semibold" : "text-gray-400 hover:text-verde"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <Spinner />
      ) : procedures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Stethoscope size={48} className="text-ambar mb-4" />
          <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum procedimento cadastrado</h2>
          <p className="text-gray-500 mb-6">Cadastre os procedimentos realizados na clínica.</p>
          <Button size="lg" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={18} /> Novo procedimento
          </Button>
        </div>
      ) : visibleProcedures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          <Search size={40} className="mb-3 opacity-30" />
          <p className="text-sm">
            Nenhum resultado para <span className="font-medium text-verde">"{search}"</span>
          </p>
        </div>
      ) : viewMode === "lista" ? (
        <div className="bg-white border border-creme-200 rounded-2xl divide-y divide-creme-100 overflow-hidden">
          {visibleProcedures.map((procedure) => (
            <div
              key={procedure.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-creme-50 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-verde-900 truncate">{procedure.name}</h2>
                  {procedure.isDefault && (
                    <span className="bg-verde-100 text-verde-900 rounded px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wide uppercase">Padrão</span>
                  )}
                  {procedure.requiresReturn && (
                    <span className="bg-ambar-50 text-ambar-700 rounded px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wide uppercase">Retorno</span>
                  )}
                  {procedure.hasMultipleSessions && (
                    <span className="bg-ia/10 text-ia rounded px-1.5 py-0.5 text-[9px] font-bold font-mono tracking-wide uppercase">Múltiplas</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {procedure.category}
                  {procedure.products?.length ? ` · ${procedure.products.length} produto${procedure.products.length > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <div className="hidden sm:block text-[11px] font-semibold text-gray-500 shrink-0">{procedure.duration} min</div>
              <div className="bg-verde-50 rounded-lg px-2.5 py-1 text-[11px] font-bold text-verde font-mono shrink-0">
                R$ {procedure.price || "0,00"}
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => handleEdit(procedure)} className="text-verde hover:text-verde-900"><Pencil size={15} /></button>
                <button onClick={() => handleDuplicate(procedure)} className="text-gray-400 hover:text-verde"><Copy size={15} /></button>
                <button className="text-erro/60 hover:text-erro" onClick={() => { setProcedureToDelete(procedure); setShowDeleteModal(true); }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {visibleProcedures.map((procedure) => (
            <div
              key={procedure.id}
              className="bg-white border border-creme-200 rounded-2xl p-5 transition hover:border-verde hover:shadow-[0_8px_24px_rgba(0,112,74,.12)]"
            >
              {/* TOP */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-[15px] font-bold text-verde-900">{procedure.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{procedure.category}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => handleEdit(procedure)} className="text-verde hover:text-verde-900">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDuplicate(procedure)} className="text-gray-400 hover:text-verde">
                    <Copy size={15} />
                  </button>
                  <button
                    className="text-erro/60 hover:text-erro"
                    onClick={() => { setProcedureToDelete(procedure); setShowDeleteModal(true); }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* DURATION / PRICE */}
              <div className="flex gap-3 flex-wrap mb-3.5">
                <div className="bg-creme-100 rounded-lg px-2.75 py-1 text-[10.5px] font-semibold text-gray-500">
                  {procedure.duration} min
                </div>
                <div className="bg-verde-50 rounded-lg px-2.75 py-1 text-[11px] font-bold text-verde font-mono">
                  R$ {procedure.price || "0,00"}
                </div>
              </div>

              {/* BADGES */}
              {(procedure.isDefault || procedure.requiresReturn || procedure.hasMultipleSessions) && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {procedure.isDefault && (
                    <span className="bg-verde-100 text-verde-900 rounded-md px-2.5 py-1 text-[10px] font-bold font-mono tracking-wide uppercase">
                      Padrão
                    </span>
                  )}
                  {procedure.requiresReturn && (
                    <span className="bg-ambar-50 text-ambar-700 rounded-md px-2.5 py-1 text-[10px] font-bold font-mono tracking-wide uppercase">
                      Requer retorno
                    </span>
                  )}
                  {procedure.hasMultipleSessions && (
                    <span className="bg-ia/10 text-ia rounded-md px-2.5 py-1 text-[10px] font-bold font-mono tracking-wide uppercase">
                      Múltiplas sessões
                    </span>
                  )}
                </div>
              )}

              {/* RETORNO */}
              {procedure.requiresReturn && (
                <div className="mb-3.5 bg-sucesso/10 text-sucesso rounded-xl p-3 text-sm">
                  ↺ Retorno em {procedure.returnDays} dias
                </div>
              )}

              {/* PRODUTOS */}
              <div className="border-t border-creme-100 pt-3">
                <div className="text-[10.5px] font-bold tracking-wide text-gray-400 uppercase mb-2">Produtos</div>
                <div className="space-y-1">
                  {!procedure.products?.length && (
                    <p className="text-sm text-gray-400">Nenhum produto vinculado</p>
                  )}
                  {procedure.products?.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-verde-900">
                      <span className="font-semibold">{item.product?.name || item.customName || "Produto"}</span>
                      <span className="text-gray-400 font-mono">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif font-light text-2xl text-verde-900">
                {editingProcedure ? "Editar procedimento" : "Novo procedimento"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-verde transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do procedimento"
                className={INPUT_CLASS}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do procedimento (será usada como template na evolução do paciente)"
                rows={4}
                className={INPUT_CLASS}
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option>Facial</option>
                  <option>Corporal</option>
                  <option>Bioestimulador</option>
                  <option>Toxina</option>
                  <option>Preenchimento</option>
                  <option>Consulta</option>
                  <option>Outros</option>
                </select>
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Duração (min)"
                  className={INPUT_CLASS}
                />
              </div>

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Preço"
                className={INPUT_CLASS}
              />

              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={hasMultipleSessions}
                    onChange={(e) => setHasMultipleSessions(e.target.checked)}
                  />
                  <span>Requer múltiplas sessões</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={requiresReturn}
                    onChange={(e) => setRequiresReturn(e.target.checked)}
                  />
                  <span>Requer retorno</span>
                </label>
              </div>

              {requiresReturn && (
                <input
                  value={returnDays}
                  onChange={(e) => setReturnDays(e.target.value)}
                  placeholder="Dias para retorno"
                  className={INPUT_CLASS}
                />
              )}

              {/* PRODUTOS */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-verde-900">Produtos utilizados</h3>
                  <Button type="button" size="sm" onClick={addProduct}>
                    + Produto
                  </Button>
                </div>

                <div className="space-y-4">
                  {selectedProducts.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3">
                      <div className="col-span-7 space-y-2">
                        <select
                          value={item.productId}
                          onChange={(e) => updateProduct(index, "productId", e.target.value)}
                          className={INPUT_CLASS}
                        >
                          <option value="">Produto do estoque</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={item.customName}
                          onChange={(e) => updateProduct(index, "customName", e.target.value)}
                          placeholder="Ou produto genérico"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <input
                        value={item.quantity}
                        onChange={(e) => updateProduct(index, "quantity", e.target.value)}
                        placeholder="Qtd"
                        className={`col-span-2 ${INPUT_CLASS}`}
                      />
                      <label className="col-span-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.perSession}
                          onChange={(e) => updateProduct(index, "perSession", e.target.checked)}
                        />
                        Sessão
                      </label>
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="col-span-1 text-erro/60 hover:text-erro"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" size="md" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button size="md" onClick={saveProcedure}>
                  {editingProcedure ? "Salvar alterações" : "Criar procedimento"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-6">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="font-serif font-light text-2xl text-verde-900 mb-3">Excluir procedimento</h2>
            <p className="text-gray-600 leading-relaxed">
              Deseja realmente excluir o procedimento{" "}
              <strong>{procedureToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-3">
              Essa ação ocultará o procedimento do sistema, mas manterá históricos já registrados.
            </p>
            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setShowDeleteModal(false); setProcedureToDelete(null); }}
              >
                Cancelar
              </Button>
              <Button
                size="md"
                className="bg-erro! hover:bg-[#C2473C]! shadow-none!"
                onClick={handleDelete}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
