import { useEffect, useState } from "react";
import { Pencil, Trash2, Copy, Plus, X, Stethoscope } from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

export default function Procedures() {
  const [procedures, setProcedures] = useState([]);
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
      toast.error("Erro ao carregar procedimentos");
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
      toast.error("Erro ao salvar procedimento");
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
      toast.error("Erro ao excluir procedimento");
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

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#00704A]">Procedimentos</h1>
          <p className="text-gray-500 mt-1">
            {procedures.length} procedimento{procedures.length !== 1 ? "s" : ""} cadastrado{procedures.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-[#00704A] hover:bg-[#0A3326] text-white px-4 py-3 rounded-xl flex items-center gap-2 transition"
        >
          <Plus size={18} />
          Novo procedimento
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <Spinner />
      ) : procedures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Stethoscope size={48} className="text-[#C4895A] mb-4" />
          <h2 className="text-xl font-semibold text-[#00704A] mb-2">Nenhum procedimento cadastrado</h2>
          <p className="text-gray-500 mb-6">Cadastre os procedimentos realizados na clínica.</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-[#00704A] hover:bg-[#0A3326] text-white px-5 py-3 rounded-xl flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Novo procedimento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {procedures.map((procedure) => (
            <div key={procedure.id} className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-5">
              {/* TOP */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#00704A]">{procedure.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{procedure.category}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleEdit(procedure)} className="text-[#00704A] hover:text-[#0A3326]">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDuplicate(procedure)} className="text-gray-400 hover:text-[#00704A]">
                    <Copy size={16} />
                  </button>
                  <button
                    className="text-red-400 hover:text-red-600"
                    onClick={() => { setProcedureToDelete(procedure); setShowDeleteModal(true); }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* INFO */}
              <div className="mt-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Duração:</span>
                  <span className="font-semibold">{procedure.duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Preço:</span>
                  <span className="font-bold text-pink-600">R$ {procedure.price || "0,00"}</span>
                </div>
              </div>

              {/* RETORNO */}
              {procedure.requiresReturn && (
                <div className="mt-5 bg-green-50 text-green-700 rounded-xl p-3 text-sm">
                  ↺ Retorno em {procedure.returnDays} dias
                </div>
              )}

              {/* PRODUTOS */}
              <div className="mt-5">
                <h3 className="font-semibold text-[#00704A] mb-2">Produtos:</h3>
                <div className="space-y-2">
                  {!procedure.products?.length && (
                    <p className="text-sm text-gray-400">Nenhum produto vinculado</p>
                  )}
                  {procedure.products?.map((item) => (
                    <div key={item.id} className="bg-white border border-[#E5D8C5] rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span>{item.product?.name || item.customName || "Produto"}</span>
                        <span className="text-gray-500">{item.quantity}</span>
                      </div>
                      {item.perSession && (
                        <p className="text-xs text-green-600 mt-1">Por sessão</p>
                      )}
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
              <h2 className="text-2xl font-bold text-[#00704A]">
                {editingProcedure ? "Editar procedimento" : "Novo procedimento"}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do procedimento"
                className="w-full border border-[#C4895A] rounded-xl p-3"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do procedimento (será usada como template na evolução do paciente)"
                rows={4}
                className="w-full border border-[#C4895A] rounded-xl p-3"
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="border border-[#C4895A] rounded-xl p-3"
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
                  className="border border-[#C4895A] rounded-xl p-3"
                />
              </div>

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Preço"
                className="w-full border border-[#C4895A] rounded-xl p-3"
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
                  className="w-full border border-[#C4895A] rounded-xl p-3"
                />
              )}

              {/* PRODUTOS */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#00704A]">Produtos utilizados</h3>
                  <button
                    type="button"
                    onClick={addProduct}
                    className="bg-[#00704A] text-white px-3 py-2 rounded-lg text-sm"
                  >
                    + Produto
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedProducts.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3">
                      <div className="col-span-7 space-y-2">
                        <select
                          value={item.productId}
                          onChange={(e) => updateProduct(index, "productId", e.target.value)}
                          className="w-full border border-[#C4895A] rounded-xl p-3"
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
                          className="w-full border border-[#C4895A] rounded-xl p-3"
                        />
                      </div>
                      <input
                        value={item.quantity}
                        onChange={(e) => updateProduct(index, "quantity", e.target.value)}
                        placeholder="Qtd"
                        className="col-span-2 border border-[#C4895A] rounded-xl p-3"
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
                        className="col-span-1 text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="border border-[#C4895A] px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProcedure}
                  className="bg-[#00704A] hover:bg-[#0A3326] text-white px-5 py-2 rounded-xl"
                >
                  {editingProcedure ? "Salvar alterações" : "Criar procedimento"}
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
            <h2 className="text-2xl font-bold text-[#00704A] mb-3">Excluir procedimento</h2>
            <p className="text-gray-600 leading-relaxed">
              Deseja realmente excluir o procedimento{" "}
              <strong>{procedureToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-3">
              Essa ação ocultará o procedimento do sistema, mas manterá históricos já registrados.
            </p>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => { setShowDeleteModal(false); setProcedureToDelete(null); }}
                className="border border-[#C4895A] px-4 py-2 rounded-xl"
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
