import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Package, ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal criar/editar
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");

  // modal excluir
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // modal movimentações
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movType, setMovType] = useState("entrada");
  const [movQty, setMovQty] = useState("");
  const [movReason, setMovReason] = useState("");
  const [savingMov, setSavingMov] = useState(false);

  async function loadProducts() {
    try {
      const response = await api.get("/products");
      setProducts(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements(productId) {
    try {
      const response = await api.get(`/products/${productId}/movements`);
      setMovements(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function saveProduct() {
    try {
      const payload = { name, description, stock, unit };
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("Produto atualizado!");
      } else {
        await api.post("/products", payload);
        toast.success("Produto criado!");
      }
      resetForm();
      setShowModal(false);
      loadProducts();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar produto");
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/products/${productToDelete.id}`);
      setShowDeleteModal(false);
      setProductToDelete(null);
      toast.success("Produto excluído");
      loadProducts();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir produto");
    }
  }

  async function handleMovement(e) {
    e.preventDefault();
    if (!movQty || Number(movQty) <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    setSavingMov(true);
    try {
      await api.post(`/products/${activeProduct.id}/movements`, {
        type: movType,
        quantity: movQty,
        reason: movReason,
      });
      toast.success(movType === "entrada" ? "Entrada registrada!" : "Saída registrada!");
      setMovQty("");
      setMovReason("");
      await Promise.all([loadMovements(activeProduct.id), loadProducts()]);
      // atualiza estoque exibido no modal
      const updated = await api.get("/products");
      const refreshed = updated.data.find((p) => p.id === activeProduct.id);
      if (refreshed) setActiveProduct(refreshed);
    } catch (error) {
      toast.error(error.response?.data?.error || "Erro ao registrar movimentação");
    } finally {
      setSavingMov(false);
    }
  }

  function openMovements(product) {
    setActiveProduct(product);
    setMovType("entrada");
    setMovQty("");
    setMovReason("");
    setMovements([]);
    setShowMovementModal(true);
    loadMovements(product.id);
  }

  function handleEdit(product) {
    setEditingProduct(product);
    setName(product.name || "");
    setDescription(product.description || "");
    setStock(product.stock ?? "");
    setUnit(product.unit || "");
    setShowModal(true);
  }

  function resetForm() {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setStock("");
    setUnit("");
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#314D3E]">Produtos</h1>
          <p className="text-gray-500 mt-1">
            {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-3 rounded-xl flex items-center gap-2 transition"
        >
          <Plus size={18} />
          Novo produto
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package size={48} className="text-[#D6C1A3] mb-4" />
          <h2 className="text-xl font-semibold text-[#314D3E] mb-2">Nenhum produto cadastrado</h2>
          <p className="text-gray-500 mb-6">Cadastre os produtos e insumos utilizados nos procedimentos.</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-3 rounded-xl flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Novo produto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {products.map((product) => (
            <div key={product.id} className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#314D3E]">{product.name}</h2>
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleEdit(product)} className="text-[#314D3E] hover:text-[#465634]">
                    <Pencil size={16} />
                  </button>
                  <button
                    className="text-red-400 hover:text-red-600"
                    onClick={() => { setProductToDelete(product); setShowDeleteModal(true); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* STOCK + ACTIONS */}
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-sm text-gray-500">Estoque atual</p>
                  <p className="text-2xl font-bold text-[#314D3E]">
                    {product.stock ?? 0}
                    <span className="text-sm font-normal text-gray-500 ml-1">{product.unit || ""}</span>
                  </p>
                </div>
                <button
                  onClick={() => openMovements(product)}
                  className="flex items-center gap-1.5 text-sm text-[#314D3E] border border-[#D6C1A3] px-3 py-1.5 rounded-lg hover:bg-[#EFE7DA] transition"
                >
                  <History size={14} />
                  Movimentar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL MOVIMENTAÇÕES */}
      {showMovementModal && activeProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* HEADER */}
            <div className="flex items-center justify-between p-6 border-b border-[#E5D8C5]">
              <div>
                <h2 className="text-xl font-bold text-[#314D3E]">{activeProduct.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Estoque atual:{" "}
                  <span className="font-semibold text-[#314D3E]">
                    {activeProduct.stock ?? 0} {activeProduct.unit || ""}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowMovementModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* FORM NOVA MOVIMENTAÇÃO */}
            <form onSubmit={handleMovement} className="p-6 border-b border-[#E5D8C5]">
              <p className="text-sm font-semibold text-[#314D3E] mb-3">Registrar movimentação</p>

              {/* TIPO TOGGLE */}
              <div className="flex rounded-xl border border-[#D6C1A3] overflow-hidden mb-4">
                <button
                  type="button"
                  onClick={() => setMovType("entrada")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition ${
                    movType === "entrada"
                      ? "bg-[#314D3E] text-white"
                      : "bg-white text-gray-500 hover:bg-[#F3EEE5]"
                  }`}
                >
                  <ArrowDownCircle size={16} />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setMovType("saida")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition ${
                    movType === "saida"
                      ? "bg-red-500 text-white"
                      : "bg-white text-gray-500 hover:bg-[#F3EEE5]"
                  }`}
                >
                  <ArrowUpCircle size={16} />
                  Saída
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantidade</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    placeholder={`ex: 5 ${activeProduct.unit || ""}`}
                    className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Motivo (opcional)</label>
                  <input
                    value={movReason}
                    onChange={(e) => setMovReason(e.target.value)}
                    placeholder="ex: Compra, Uso em procedimento"
                    className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingMov}
                className="w-full bg-[#314D3E] hover:bg-[#465634] text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
              >
                {savingMov ? "Salvando..." : "Registrar"}
              </button>
            </form>

            {/* HISTÓRICO */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm font-semibold text-[#314D3E] mb-3">Histórico</p>
              {movements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma movimentação registrada</p>
              ) : (
                <div className="space-y-2">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between bg-[#FAF7F2] border border-[#E5D8C5] rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {mov.type === "entrada" ? (
                          <ArrowDownCircle size={18} className="text-[#314D3E]" />
                        ) : (
                          <ArrowUpCircle size={18} className="text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#314D3E]">
                            {mov.type === "entrada" ? "Entrada" : "Saída"}{" "}
                            <span className="font-bold">
                              +{mov.quantity} {activeProduct.unit || ""}
                            </span>
                          </p>
                          {mov.reason && (
                            <p className="text-xs text-gray-500">{mov.reason}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(mov.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#314D3E]">
                {editingProduct ? "Editar produto" : "Novo produto"}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do produto"
                className="w-full border border-[#D6C1A3] rounded-xl p-3"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                rows={3}
                className="w-full border border-[#D6C1A3] rounded-xl p-3"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Estoque inicial"
                  type="number"
                  className="border border-[#D6C1A3] rounded-xl p-3"
                />
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Unidade (ml, un, g...)"
                  className="border border-[#D6C1A3] rounded-xl p-3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="border border-[#D6C1A3] px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProduct}
                  className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2 rounded-xl"
                >
                  {editingProduct ? "Salvar alterações" : "Criar produto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-6">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-[#314D3E] mb-3">Excluir produto</h2>
            <p className="text-gray-600">
              Deseja excluir o produto <strong>{productToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Produtos vinculados a procedimentos serão desvinculados.
            </p>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }}
                className="border border-[#D6C1A3] px-4 py-2 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
