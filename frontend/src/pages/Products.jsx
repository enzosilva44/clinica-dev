import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, Package,
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle,
  Clock, Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function stockStatus(product) {
  const s = product.stock ?? 0;
  if (s <= 0) return "zero";
  if (product.minStock != null && s <= product.minStock) return "low";
  return "ok";
}

const STATUS_STYLES = {
  ok:   { bar: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700", label: "OK" },
  low:  { bar: "bg-amber-400",   pill: "bg-amber-100 text-amber-700",     label: "Baixo" },
  zero: { bar: "bg-red-400",     pill: "bg-red-100 text-red-600",         label: "Zerado" },
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(d) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const INPUT = "w-full border border-[#CBA258] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00704A]/20";

// ─── tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "estoque",       label: "Estoque" },
  { id: "solicitacoes",  label: "Solicitações" },
  { id: "extrato",       label: "Extrato" },
];

// ─── main ────────────────────────────────────────────────────────────────────

export default function Products() {
  const [tab, setTab] = useState("estoque");

  // produtos
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal produto
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", stock: "", minStock: "", unit: "" });

  // modal excluir
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // modal solicitar movimentação
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestProduct, setRequestProduct] = useState(null);
  const [reqType, setReqType] = useState("entrada");
  const [reqQty, setReqQty] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [savingReq, setSavingReq] = useState(false);

  // solicitações
  const [requests, setRequests] = useState([]);
  const [loadingReq, setLoadingReq] = useState(false);
  const [reqFilter, setReqFilter] = useState("pending");

  // extrato
  const [movements, setMovements] = useState([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [movProductFilter, setMovProductFilter] = useState("");
  const [movStart, setMovStart] = useState("");
  const [movEnd, setMovEnd] = useState("");

  // ── loaders ────────────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    try {
      const r = await api.get("/products");
      setProducts(r.data);
    } catch {
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingReq(true);
    try {
      const r = await api.get("/products/stock-requests", { params: { status: reqFilter } });
      setRequests(r.data);
    } catch {
      toast.error("Erro ao carregar solicitações");
    } finally {
      setLoadingReq(false);
    }
  }, [reqFilter]);

  const loadMovements = useCallback(async () => {
    setLoadingMov(true);
    try {
      const r = await api.get("/products/movements/all", {
        params: {
          productId: movProductFilter || undefined,
          startDate: movStart || undefined,
          endDate: movEnd || undefined,
        },
      });
      setMovements(r.data);
    } catch {
      toast.error("Erro ao carregar extrato");
    } finally {
      setLoadingMov(false);
    }
  }, [movProductFilter, movStart, movEnd]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === "solicitacoes") loadRequests(); }, [tab, loadRequests]);
  useEffect(() => { if (tab === "extrato") loadMovements(); }, [tab, loadMovements]);

  // ── produto CRUD ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingProduct(null);
    setForm({ name: "", description: "", stock: "", minStock: "", unit: "" });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingProduct(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      stock: p.stock ?? "",
      minStock: p.minStock ?? "",
      unit: p.unit || "",
    });
    setShowModal(true);
  }

  async function saveProduct() {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    try {
      const payload = { ...form };
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success("Produto atualizado!");
      } else {
        await api.post("/products", payload);
        toast.success("Produto criado!");
      }
      setShowModal(false);
      loadProducts();
    } catch {
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
    } catch {
      toast.error("Erro ao excluir produto");
    }
  }

  // ── solicitar movimentação ──────────────────────────────────────────────────

  function openRequest(product) {
    setRequestProduct(product);
    setReqType("entrada");
    setReqQty("");
    setReqReason("");
    setShowRequestModal(true);
  }

  async function handleRequest(e) {
    e.preventDefault();
    if (!reqQty || Number(reqQty) <= 0) return toast.error("Quantidade inválida");
    setSavingReq(true);
    try {
      await api.post("/products/stock-requests", {
        productId: requestProduct.id,
        type: reqType,
        quantity: reqQty,
        reason: reqReason,
      });
      toast.success("Solicitação enviada! Aguardando aprovação.");
      setShowRequestModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar solicitação");
    } finally {
      setSavingReq(false);
    }
  }

  // ── aprovar / rejeitar ──────────────────────────────────────────────────────

  async function handleApprove(id) {
    try {
      await api.patch(`/products/stock-requests/${id}/approve`);
      toast.success("Solicitação aprovada e estoque atualizado!");
      loadRequests();
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao aprovar");
    }
  }

  async function handleReject(id) {
    try {
      await api.patch(`/products/stock-requests/${id}/reject`);
      toast.success("Solicitação rejeitada");
      loadRequests();
    } catch {
      toast.error("Erro ao rejeitar");
    }
  }

  // ── stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: products.length,
    ok:    products.filter((p) => stockStatus(p) === "ok").length,
    low:   products.filter((p) => stockStatus(p) === "low").length,
    zero:  products.filter((p) => stockStatus(p) === "zero").length,
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#00704A]">Produtos & Estoque</h1>
          <p className="text-gray-500 mt-1 text-sm">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#00704A] hover:bg-[#1E3932] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition"
        >
          <Plus size={16} /> Novo produto
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-[#F2F0EB] border border-[#DDD8CC] rounded-xl p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${
              tab === t.id
                ? "bg-white text-[#00704A] shadow-sm"
                : "text-gray-500 hover:text-[#00704A]"
            }`}
          >
            {t.label}
            {t.id === "solicitacoes" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: ESTOQUE ─────────────────────────────────────────────────────── */}
      {tab === "estoque" && (
        <>
          {/* summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total",   value: stats.total, color: "text-[#00704A]",   bg: "bg-[#F2F0EB]" },
              { label: "OK",      value: stats.ok,    color: "text-emerald-600",  bg: "bg-emerald-50" },
              { label: "Baixo",   value: stats.low,   color: "text-amber-600",    bg: "bg-amber-50" },
              { label: "Zerado",  value: stats.zero,  color: "text-red-500",      bg: "bg-red-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-[#DDD8CC] rounded-2xl p-4`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Package size={48} className="text-[#CBA258] mb-4" />
              <h2 className="text-xl font-semibold text-[#00704A] mb-2">Nenhum produto cadastrado</h2>
              <p className="text-gray-500 mb-6">Cadastre produtos e insumos utilizados nos procedimentos.</p>
              <button onClick={openCreate} className="bg-[#00704A] hover:bg-[#1E3932] text-white px-5 py-3 rounded-xl flex items-center gap-2 transition">
                <Plus size={18} /> Novo produto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => {
                const st = stockStatus(product);
                const styles = STATUS_STYLES[st];
                const stockVal = product.stock ?? 0;
                const barPct = product.minStock
                  ? Math.min(100, (stockVal / (product.minStock * 3)) * 100)
                  : stockVal > 0 ? 100 : 0;

                return (
                  <div key={product.id} className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl p-5 flex flex-col gap-4">
                    {/* top */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-[#00704A] truncate">{product.name}</h2>
                        {product.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>
                        )}
                      </div>
                      <span className={`ml-2 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.pill}`}>
                        {styles.label}
                      </span>
                    </div>

                    {/* stock number */}
                    <div>
                      <p className="text-4xl font-bold text-[#00704A] leading-none">
                        {stockVal % 1 === 0 ? stockVal : stockVal.toFixed(2)}
                        <span className="text-sm font-normal text-gray-400 ml-1.5">{product.unit || "un"}</span>
                      </p>
                      {product.minStock != null && (
                        <p className="text-[11px] text-gray-400 mt-1">mín. {product.minStock} {product.unit || "un"}</p>
                      )}
                    </div>

                    {/* bar */}
                    <div className="h-1.5 bg-[#E6E2D8] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${styles.bar}`}
                        style={{ width: `${Math.max(barPct, stockVal > 0 ? 4 : 0)}%` }}
                      />
                    </div>

                    {/* actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => openRequest(product)}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#00704A] hover:bg-[#1E3932] px-3 py-2 rounded-lg transition"
                      >
                        <Plus size={13} /> Solicitar movimentação
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(product)} className="text-[#00704A]/60 hover:text-[#00704A] transition">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setProductToDelete(product); setShowDeleteModal(true); }}
                          className="text-red-300 hover:text-red-500 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: SOLICITAÇÕES ────────────────────────────────────────────────── */}
      {tab === "solicitacoes" && (
        <>
          {/* filter pills */}
          <div className="flex gap-2 mb-5">
            {[
              { value: "pending",  label: "Pendentes" },
              { value: "approved", label: "Aprovadas" },
              { value: "rejected", label: "Rejeitadas" },
              { value: "all",      label: "Todas" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setReqFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  reqFilter === f.value
                    ? "bg-[#00704A] text-white"
                    : "bg-[#F2F0EB] border border-[#DDD8CC] text-gray-500 hover:text-[#00704A]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingReq ? (
            <Spinner />
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center text-gray-400">
              <CheckCircle2 size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* tipo badge */}
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                    req.type === "entrada" ? "bg-emerald-100" : "bg-red-100"
                  }`}>
                    {req.type === "entrada"
                      ? <ArrowDownCircle size={20} className="text-emerald-600" />
                      : <ArrowUpCircle size={20} className="text-red-500" />}
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#00704A] text-sm">{req.product.name}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        req.type === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      }`}>
                        {req.type === "entrada" ? "Entrada" : "Saída"} · {req.quantity} {req.product.unit || "un"}
                      </span>
                    </div>
                    {req.reason && <p className="text-xs text-gray-500 mt-0.5 truncate">{req.reason}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{fmtDate(req.createdAt)}</p>
                  </div>

                  {/* status / ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    {req.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition"
                        >
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex items-center gap-1.5 border border-red-300 text-red-500 hover:bg-red-50 text-xs font-medium px-3 py-2 rounded-lg transition"
                        >
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </>
                    ) : (
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                        req.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {req.status === "approved"
                          ? <><CheckCircle2 size={13} /> Aprovada</>
                          : <><XCircle size={13} /> Rejeitada</>}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: EXTRATO ─────────────────────────────────────────────────────── */}
      {tab === "extrato" && (
        <>
          {/* filtros */}
          <div className="flex flex-wrap gap-3 mb-5 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Produto</label>
              <select
                value={movProductFilter}
                onChange={(e) => setMovProductFilter(e.target.value)}
                className="border border-[#CBA258] rounded-xl px-3 py-2 text-sm bg-white min-w-[180px]"
              >
                <option value="">Todos os produtos</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">De</label>
              <input
                type="date"
                value={movStart}
                onChange={(e) => setMovStart(e.target.value)}
                className="border border-[#CBA258] rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Até</label>
              <input
                type="date"
                value={movEnd}
                onChange={(e) => setMovEnd(e.target.value)}
                className="border border-[#CBA258] rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={loadMovements}
              className="flex items-center gap-1.5 bg-[#00704A] hover:bg-[#1E3932] text-white text-sm px-4 py-2 rounded-xl transition"
            >
              <Filter size={14} /> Filtrar
            </button>
            {(movProductFilter || movStart || movEnd) && (
              <button
                onClick={() => { setMovProductFilter(""); setMovStart(""); setMovEnd(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Limpar
              </button>
            )}
          </div>

          {loadingMov ? (
            <Spinner />
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center text-gray-400">
              <Clock size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="bg-white border border-[#DDD8CC] rounded-2xl overflow-hidden">
              {/* header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-[#F2F0EB] border-b border-[#DDD8CC] text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span>Produto / Motivo</span>
                <span>Tipo</span>
                <span>Quantidade</span>
                <span>Data</span>
              </div>

              {/* rows */}
              <div className="divide-y divide-[#F2F0EB]">
                {movements.map((mov, i) => (
                  <div
                    key={mov.id}
                    className={`grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center hover:bg-[#FAFAF8] transition ${
                      i % 2 === 0 ? "" : "bg-[#FDFCFA]"
                    }`}
                  >
                    {/* produto */}
                    <div>
                      <p className="text-sm font-semibold text-[#00704A]">{mov.product?.name}</p>
                      {mov.reason && <p className="text-xs text-gray-400 mt-0.5">{mov.reason}</p>}
                    </div>

                    {/* tipo */}
                    <div className="flex items-center gap-1.5">
                      {mov.type === "entrada" ? (
                        <ArrowDownCircle size={15} className="text-emerald-500 shrink-0" />
                      ) : (
                        <ArrowUpCircle size={15} className="text-red-400 shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${mov.type === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                        {mov.type === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </div>

                    {/* qty */}
                    <p className={`text-base font-bold ${mov.type === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                      {mov.type === "entrada" ? "+" : "−"}{mov.quantity} {mov.product?.unit || "un"}
                    </p>

                    {/* data */}
                    <p className="text-xs text-gray-400 whitespace-nowrap">{fmtDateShort(mov.createdAt)}</p>
                  </div>
                ))}
              </div>

              {/* footer */}
              <div className="px-5 py-3 bg-[#F2F0EB] border-t border-[#DDD8CC] text-xs text-gray-400">
                {movements.length} movimentaç{movements.length !== 1 ? "ões" : "ão"}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL: SOLICITAR MOVIMENTAÇÃO ──────────────────────────────────── */}
      {showRequestModal && requestProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#00704A]">Solicitar movimentação</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {requestProduct.name} · estoque atual:{" "}
                  <strong>{requestProduct.stock ?? 0} {requestProduct.unit || "un"}</strong>
                </p>
              </div>
              <button onClick={() => setShowRequestModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleRequest} className="space-y-4">
              {/* tipo toggle */}
              <div className="flex rounded-xl border border-[#CBA258] overflow-hidden">
                {[
                  { value: "entrada", label: "Entrada", icon: ArrowDownCircle, active: "bg-emerald-500" },
                  { value: "saida",   label: "Saída",   icon: ArrowUpCircle,   active: "bg-red-500" },
                ].map(({ value, label, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReqType(value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition ${
                      reqType === value ? `${active} text-white` : "bg-white text-gray-500 hover:bg-[#F2F0EB]"
                    }`}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantidade *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    placeholder={`ex: 10 ${requestProduct.unit || ""}`}
                    className={INPUT}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Motivo</label>
                  <input
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="ex: Compra, procedimento..."
                    className={INPUT}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-400 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                A solicitação será enviada para aprovação antes de alterar o estoque.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 border border-[#CBA258] text-[#00704A] py-2.5 rounded-xl text-sm hover:bg-[#E6E2D8] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReq}
                  className="flex-1 bg-[#00704A] hover:bg-[#1E3932] text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {savingReq ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CRIAR / EDITAR PRODUTO ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#00704A]">
                {editingProduct ? "Editar produto" : "Novo produto"}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do produto"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição opcional"
                  rows={2}
                  className={`${INPUT} resize-none`}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Estoque inicial</label>
                  <input
                    value={form.stock}
                    onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                    placeholder="0"
                    type="number"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Estoque mínimo</label>
                  <input
                    value={form.minStock}
                    onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))}
                    placeholder="alerta"
                    type="number"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unidade</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    placeholder="ml, un, g…"
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="border border-[#CBA258] px-4 py-2.5 rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProduct}
                  className="bg-[#00704A] hover:bg-[#1E3932] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  {editingProduct ? "Salvar" : "Criar produto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXCLUIR ────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-[#00704A] mb-2">Excluir produto</h2>
            <p className="text-sm text-gray-600">
              Deseja excluir <strong>{productToDelete?.name}</strong>? O histórico de movimentações será removido.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }}
                className="border border-[#CBA258] px-4 py-2 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
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
