import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, Package,
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle,
  Clock, Filter, AlertTriangle, CalendarClock,
  Sparkles, ShieldCheck, RefreshCw, Info, Search, LayoutGrid, List,
} from "lucide-react";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import { Button, SearchableSelect } from "../components/ui";
import api from "../services/api";
import { fmtDateOnly } from "../utils/date";

// Dias até a validade (data-só, guardada como meia-noite UTC → lemos em UTC).
const EXPIRY_WARN_DAYS = 30;
function expiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const e = new Date(expiryDate);
  if (isNaN(e)) return null;
  const exp = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((exp - today) / 86400000);
  if (days < 0) return { level: "expired", days, label: "Vencido" };
  if (days === 0) return { level: "expired", days, label: "Vence hoje" };
  if (days <= EXPIRY_WARN_DAYS) return { level: "soon", days, label: `Vence em ${days}d` };
  return { level: "ok", days, label: null };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function stockStatus(product) {
  const s = product.stock ?? 0;
  if (s <= 0) return "zero";
  if (product.minStock != null && s <= product.minStock) return "low";
  return "ok";
}

const STATUS_STYLES = {
  ok:   { bar: "bg-sucesso", pill: "bg-verde-100 text-verde-900", label: "OK" },
  low:  { bar: "bg-ambar",   pill: "bg-ambar-50 text-ambar-700",  label: "Baixo" },
  zero: { bar: "bg-erro",    pill: "bg-erro/10 text-erro",        label: "Zerado" },
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

const INPUT = "w-full border border-creme-200 bg-creme-50 rounded-xl p-3 text-sm outline-none focus:border-verde focus:bg-white transition-colors";

// ─── tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "estoque",       label: "Estoque" },
  { id: "solicitacoes",  label: "Solicitações" },
  { id: "extrato",       label: "Extrato" },
  { id: "guardiao",      label: "Guardião IA" },
];

// ─── Guardião de Produtos (IA) ────────────────────────────────────────────────
const PROD_SEVERITY = {
  critico: { bg: "bg-erro/5 border-erro/25", badge: "bg-erro/15 text-erro", icon: AlertTriangle, iconColor: "text-erro", label: "Crítico" },
  alerta:  { bg: "bg-atencao/5 border-atencao/25", badge: "bg-atencao/15 text-atencao-700", icon: AlertTriangle, iconColor: "text-atencao", label: "Alerta" },
  info:    { bg: "bg-info/5 border-info/25", badge: "bg-info/15 text-info", icon: Info, iconColor: "text-info", label: "Info" },
};

function ScoreRing({ score }) {
  const color = score >= 80 ? "#3A9B6F" : score >= 50 ? "#C4895A" : "#E2574C";
  const r = 36, circ = 2 * Math.PI * r, offset = circ * (1 - score / 100);
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#EFE7DA" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black font-mono" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400 font-medium">score</span>
      </div>
    </div>
  );
}

function ProductGuardianTab({ data, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-verde flex items-center justify-center animate-pulse">
          <Sparkles size={20} className="text-ambar" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-verde-900">Analisando uso de produtos…</p>
          <p className="text-xs text-gray-400 mt-1">A IA está verificando inconsistências</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-creme-100 flex items-center justify-center">
          <ShieldCheck size={28} className="text-ambar" />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-verde-900">Guardião de Produtos</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            A IA verifica produtos usados mas não cadastrados, baixas duplicadas na mesma sessão,
            estoque zerado em uso e produtos vencidos aplicados.
          </p>
        </div>
        <button onClick={onRefresh}
          className="bg-verde hover:bg-verde-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition">
          <Sparkles size={15} /> Analisar agora
        </button>
      </div>
    );
  }

  const criticos = data.alerts?.filter((a) => a.severity === "critico") ?? [];
  const alertas = data.alerts?.filter((a) => a.severity === "alerta") ?? [];
  const infos = data.alerts?.filter((a) => a.severity === "info") ?? [];
  const allAlerts = [...criticos, ...alertas, ...infos];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-creme-200 rounded-2xl p-5 flex items-center gap-5">
        <ScoreRing score={data.score ?? 0} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-verde shrink-0" />
            <p className="text-sm font-bold text-verde-900">Consistência de Produtos</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{data.resumo}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {criticos.length > 0 && <span className="text-xs bg-erro/15 text-erro font-semibold px-2.5 py-1 rounded-full">{criticos.length} crítico{criticos.length > 1 ? "s" : ""}</span>}
            {alertas.length > 0 && <span className="text-xs bg-atencao/15 text-atencao-700 font-semibold px-2.5 py-1 rounded-full">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</span>}
            {infos.length > 0 && <span className="text-xs bg-info/15 text-info font-semibold px-2.5 py-1 rounded-full">{infos.length} info</span>}
            {allAlerts.length === 0 && <span className="text-xs bg-sucesso/15 text-sucesso font-semibold px-2.5 py-1 rounded-full">Tudo ok</span>}
          </div>
        </div>
        <button onClick={onRefresh}
          className="shrink-0 w-9 h-9 rounded-xl border border-creme-200 hover:bg-creme-50 flex items-center justify-center transition text-gray-400 hover:text-verde"
          title="Reanalisar">
          <RefreshCw size={15} />
        </button>
      </div>

      {allAlerts.length === 0 ? (
        <div className="bg-sucesso/5 border border-sucesso/25 rounded-2xl p-6 flex items-center gap-4">
          <ShieldCheck size={32} className="text-sucesso shrink-0" />
          <div>
            <p className="text-sm font-bold text-sucesso">Nenhuma inconsistência encontrada</p>
            <p className="text-xs text-sucesso/80 mt-0.5">Os produtos usados nos mapas estão consistentes com o estoque.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {allAlerts.map((alert, i) => {
            const cfg = PROD_SEVERITY[alert.severity] ?? PROD_SEVERITY.info;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`border rounded-2xl p-5 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={18} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.badge}`}>{cfg.label}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{alert.tipo}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800 mb-1">{alert.titulo}</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{alert.descricao}</p>
                    {alert.produtos?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {alert.produtos.map((p, j) => (
                          <span key={j} className="text-[11px] bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-gray-600 font-medium">{p}</span>
                        ))}
                      </div>
                    )}
                    {alert.acaoSugerida && (
                      <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-gray-200/60">
                        <CheckCircle2 size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-500 leading-relaxed">{alert.acaoSugerida}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function Products() {
  const [tab, setTab] = useState("estoque");

  // produtos
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("products:viewMode") || "card"); // card | lista

  // modal produto
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", supplier: "", unitPrice: "", stock: "", minStock: "", unit: "", lotNumber: "", expiryDate: "" });

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
    } catch (err) {
      toast.error(mensagemDeErro(err, "carregar os produtos"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingReq(true);
    try {
      const r = await api.get("/products/stock-requests", { params: { status: reqFilter } });
      setRequests(r.data);
    } catch (err) {
      toast.error(mensagemDeErro(err, "carregar as solicitações"));
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
    } catch (err) {
      toast.error(mensagemDeErro(err, "carregar o extrato"));
    } finally {
      setLoadingMov(false);
    }
  }, [movProductFilter, movStart, movEnd]);

  // ── Guardião de Produtos (IA) ──
  const [guardian, setGuardian] = useState(null);
  const [guardianLoading, setGuardianLoading] = useState(false);
  const loadGuardian = useCallback(async () => {
    setGuardianLoading(true);
    try {
      const r = await api.get("/ai/product-health");
      setGuardian(r.data);
    } catch (e) {
      toast.error(mensagemDeErro(e, "analisar os produtos"));
    } finally {
      setGuardianLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === "solicitacoes") loadRequests(); }, [tab, loadRequests]);
  useEffect(() => { if (tab === "extrato") loadMovements(); }, [tab, loadMovements]);
  useEffect(() => { if (tab === "guardiao" && !guardian) loadGuardian(); }, [tab, guardian, loadGuardian]);

  // ── produto CRUD ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingProduct(null);
    setForm({ name: "", description: "", category: "", supplier: "", unitPrice: "", stock: "", minStock: "", unit: "", lotNumber: "", expiryDate: "" });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingProduct(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      category: p.category || "",
      supplier: p.supplier || "",
      unitPrice: p.unitPrice ?? "",
      stock: p.stock ?? "",
      minStock: p.minStock ?? "",
      unit: p.unit || "",
      lotNumber: p.lotNumber || "",
      expiryDate: p.expiryDate ? String(p.expiryDate).slice(0, 10) : "",
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
    } catch (err) {
      toast.error(mensagemDeErro(err, "salvar o produto"));
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/products/${productToDelete.id}`);
      setShowDeleteModal(false);
      setProductToDelete(null);
      toast.success("Produto excluído");
      loadProducts();
    } catch (err) {
      toast.error(mensagemDeErro(err, "excluir o produto"));
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
      toast.error(mensagemDeErro(err, "criar a solicitação"));
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
      toast.error(mensagemDeErro(err, "aprovar a solicitação"));
    }
  }

  async function handleReject(id) {
    try {
      await api.patch(`/products/stock-requests/${id}/reject`);
      toast.success("Solicitação rejeitada");
      loadRequests();
    } catch (err) {
      toast.error(mensagemDeErro(err, "rejeitar a solicitação"));
    }
  }

  // ── stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: products.length,
    ok:    products.filter((p) => stockStatus(p) === "ok").length,
    low:   products.filter((p) => stockStatus(p) === "low").length,
    zero:  products.filter((p) => stockStatus(p) === "zero").length,
    expiring: products.filter((p) => {
      const e = expiryStatus(p.expiryDate);
      return e && (e.level === "soon" || e.level === "expired");
    }).length,
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // busca + ordenação (client-side) da lista de estoque
  const q = search.trim().toLowerCase();
  const visibleProducts = products
    .filter((p) => !q || (p.name || "").toLowerCase().includes(q))
    .sort((a, b) =>
      sortBy === "name_desc"
        ? (b.name || "").localeCompare(a.name || "", "pt-BR")
        : (a.name || "").localeCompare(b.name || "", "pt-BR")
    );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Produtos & Estoque</h1>
          <p className="text-gray-500 mt-1 text-sm">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="md" onClick={openCreate}>
          <Plus size={16} /> Novo produto
        </Button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-creme-100 rounded-xl p-0.75 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition relative ${
              tab === t.id
                ? "bg-white text-verde shadow-sm"
                : "text-gray-500 hover:text-verde"
            }`}
          >
            {t.label}
            {t.id === "solicitacoes" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-ambar text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total",    value: stats.total,    color: "text-verde-900", bg: "bg-creme-50" },
              { label: "OK",       value: stats.ok,       color: "text-sucesso",   bg: "bg-verde-50" },
              { label: "Baixo",    value: stats.low,      color: "text-ambar-700", bg: "bg-ambar-50" },
              { label: "Zerado",   value: stats.zero,     color: "text-erro",      bg: "bg-erro/5" },
              { label: "A vencer", value: stats.expiring, color: "text-ambar-700", bg: "bg-ambar-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-creme-200 rounded-2xl p-4`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* busca + ordem */}
          {products.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto por nome…"
                  className="w-full pl-10 pr-4 py-2.5 border border-ambar rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-ambar rounded-xl px-3 py-2.5 text-sm bg-white text-verde focus:outline-none focus:ring-2 focus:ring-verde/20 cursor-pointer"
                aria-label="Ordenar produtos"
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
                    onClick={() => { setViewMode(key); localStorage.setItem("products:viewMode", key); }}
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

          {loading ? (
            <Spinner />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Package size={48} className="text-ambar mb-4" />
              <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum produto cadastrado</h2>
              <p className="text-gray-500 mb-6">Cadastre produtos e insumos utilizados nos procedimentos.</p>
              <Button size="lg" onClick={openCreate}>
                <Plus size={18} /> Novo produto
              </Button>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-sm">
                Nenhum resultado para <span className="font-medium text-verde">"{search}"</span>
              </p>
            </div>
          ) : viewMode === "lista" ? (
            <div className="bg-white border border-creme-200 rounded-2xl divide-y divide-creme-100 overflow-hidden">
              {visibleProducts.map((product) => {
                const st = stockStatus(product);
                const styles = STATUS_STYLES[st];
                const stockVal = product.stock ?? 0;
                return (
                  <div key={product.id} className="flex items-center gap-4 px-4 py-3 hover:bg-creme-50 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-verde-900 truncate">{product.name}</h2>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${styles.pill}`}>{styles.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {product.category || "sem categoria"}
                        {product.supplier ? ` · ${product.supplier}` : ""}
                      </p>
                    </div>
                    {product.unitPrice != null && (
                      <div className="hidden md:block text-[11px] font-semibold text-gray-500 shrink-0 whitespace-nowrap">
                        {product.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/{product.unit || "un"}
                      </div>
                    )}
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold font-mono text-verde-900 leading-none">
                        {stockVal % 1 === 0 ? stockVal : stockVal.toFixed(2)}
                        <span className="text-[11px] font-sans font-normal text-gray-400 ml-1">{product.unit || "un"}</span>
                      </p>
                      {product.minStock != null && (
                        <p className="text-[10px] text-gray-400 mt-0.5">mín. {product.minStock}</p>
                      )}
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button onClick={() => openRequest(product)} className="text-verde/60 hover:text-verde transition" title="Solicitar movimentação"><Plus size={15} /></button>
                      <button onClick={() => openEdit(product)} className="text-verde hover:text-verde-900 transition"><Pencil size={15} /></button>
                      <button onClick={() => { setProductToDelete(product); setShowDeleteModal(true); }} className="text-erro/50 hover:text-erro transition"><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProducts.map((product) => {
                const st = stockStatus(product);
                const styles = STATUS_STYLES[st];
                const exp = expiryStatus(product.expiryDate);
                const stockVal = product.stock ?? 0;
                const barPct = product.minStock
                  ? Math.min(100, (stockVal / (product.minStock * 3)) * 100)
                  : stockVal > 0 ? 100 : 0;

                return (
                  <div key={product.id} className="bg-white border border-creme-200 rounded-2xl p-5 flex flex-col gap-4">
                    {/* top */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-verde-900 truncate">{product.name}</h2>
                        {product.category && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-creme-100 text-gray-500">
                            {product.category}
                          </span>
                        )}
                        {product.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>
                        )}
                      </div>
                      <div className="ml-2 shrink-0 flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.pill}`}>
                          {styles.label}
                        </span>
                        {exp?.label && (
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            exp.level === "expired" ? "bg-erro/10 text-erro" : "bg-ambar-50 text-ambar-700"
                          }`}>
                            <AlertTriangle size={10} /> {exp.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* stock number */}
                    <div>
                      <p className="text-4xl font-bold font-mono text-verde-900 leading-none">
                        {stockVal % 1 === 0 ? stockVal : stockVal.toFixed(2)}
                        <span className="text-sm font-sans font-normal text-gray-400 ml-1.5">{product.unit || "un"}</span>
                      </p>
                      {product.minStock != null && (
                        <p className="text-[11px] text-gray-400 mt-1">mín. {product.minStock} {product.unit || "un"}</p>
                      )}
                    </div>

                    {/* bar */}
                    <div className="h-1.5 bg-creme-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${styles.bar}`}
                        style={{ width: `${Math.max(barPct, stockVal > 0 ? 4 : 0)}%` }}
                      />
                    </div>

                    {/* lote / validade */}
                    {(product.lotNumber || product.expiryDate) && (
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 -mt-1">
                        {product.lotNumber && <span>Lote {product.lotNumber}</span>}
                        {product.expiryDate && (
                          <span className={`flex items-center gap-1 ${
                            exp?.level === "expired" ? "text-erro font-medium"
                            : exp?.level === "soon" ? "text-ambar-700 font-medium" : ""
                          }`}>
                            <CalendarClock size={11} /> val. {fmtDateOnly(product.expiryDate)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* fornecedor / preço unitário */}
                    {(product.supplier || product.unitPrice != null) && (
                      <div className="flex items-center justify-between text-[11px] text-gray-400 -mt-1">
                        {product.supplier
                          ? <span className="truncate">{product.supplier}</span>
                          : <span />}
                        {product.unitPrice != null && (
                          <span className="font-medium text-verde-900 whitespace-nowrap">
                            {product.unitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            <span className="text-gray-400 font-normal">/{product.unit || "un"}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* actions */}
                    <div className="flex items-center justify-between pt-1">
                      <Button size="sm" onClick={() => openRequest(product)}>
                        <Plus size={13} /> Solicitar movimentação
                      </Button>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(product)} className="text-verde/60 hover:text-verde transition">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setProductToDelete(product); setShowDeleteModal(true); }}
                          className="text-erro/40 hover:text-erro transition"
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
                    ? "bg-verde text-white"
                    : "bg-creme-50 border border-creme-200 text-gray-500 hover:text-verde"
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
                  className="bg-white border border-creme-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* tipo badge */}
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                    req.type === "entrada" ? "bg-verde-100" : "bg-erro/10"
                  }`}>
                    {req.type === "entrada"
                      ? <ArrowDownCircle size={20} className="text-sucesso" />
                      : <ArrowUpCircle size={20} className="text-erro" />}
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-verde-900 text-sm">{req.product.name}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        req.type === "entrada" ? "bg-verde-100 text-verde-900" : "bg-erro/10 text-erro"
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
                          className="flex items-center gap-1.5 bg-sucesso hover:bg-verde-900 text-white text-xs font-medium px-3 py-2 rounded-lg transition"
                        >
                          <CheckCircle2 size={14} /> Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex items-center gap-1.5 border border-erro/40 text-erro hover:bg-erro/5 text-xs font-medium px-3 py-2 rounded-lg transition"
                        >
                          <XCircle size={14} /> Rejeitar
                        </button>
                      </>
                    ) : (
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                        req.status === "approved"
                          ? "bg-verde-100 text-verde-900"
                          : "bg-erro/10 text-erro"
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
              <SearchableSelect
                value={movProductFilter}
                onChange={setMovProductFilter}
                placeholder="Todos os produtos"
                className="min-w-[180px]"
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">De</label>
              <input
                type="date"
                value={movStart}
                onChange={(e) => setMovStart(e.target.value)}
                className="border border-creme-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Até</label>
              <input
                type="date"
                value={movEnd}
                onChange={(e) => setMovEnd(e.target.value)}
                className="border border-creme-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <Button size="md" onClick={loadMovements}>
              <Filter size={14} /> Filtrar
            </Button>
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
            <div className="bg-white border border-creme-200 rounded-2xl overflow-hidden">
              {/* header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-creme-50 border-b border-creme-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span>Produto / Motivo</span>
                <span>Tipo</span>
                <span>Quantidade</span>
                <span>Data</span>
              </div>

              {/* rows */}
              <div className="divide-y divide-creme-50">
                {movements.map((mov, i) => (
                  <div
                    key={mov.id}
                    className={`grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-4 items-center hover:bg-creme-50/60 transition ${
                      i % 2 === 0 ? "" : "bg-creme-50/30"
                    }`}
                  >
                    {/* produto */}
                    <div>
                      <p className="text-sm font-semibold text-verde-900">{mov.product?.name}</p>
                      {mov.reason && <p className="text-xs text-gray-400 mt-0.5">{mov.reason}</p>}
                    </div>

                    {/* tipo */}
                    <div className="flex items-center gap-1.5">
                      {mov.type === "entrada" ? (
                        <ArrowDownCircle size={15} className="text-sucesso shrink-0" />
                      ) : (
                        <ArrowUpCircle size={15} className="text-erro shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${mov.type === "entrada" ? "text-sucesso" : "text-erro"}`}>
                        {mov.type === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </div>

                    {/* qty */}
                    <p className={`text-base font-bold font-mono ${mov.type === "entrada" ? "text-sucesso" : "text-erro"}`}>
                      {mov.type === "entrada" ? "+" : "−"}{mov.quantity} {mov.product?.unit || "un"}
                    </p>

                    {/* data */}
                    <p className="text-xs text-gray-400 whitespace-nowrap font-mono">{fmtDateShort(mov.createdAt)}</p>
                  </div>
                ))}
              </div>

              {/* footer */}
              <div className="px-5 py-3 bg-creme-50 border-t border-creme-200 text-xs text-gray-400">
                {movements.length} movimentaç{movements.length !== 1 ? "ões" : "ão"}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: GUARDIÃO IA ─────────────────────────────────────────────────── */}
      {tab === "guardiao" && (
        <ProductGuardianTab data={guardian} loading={guardianLoading} onRefresh={loadGuardian} />
      )}

      {/* ── MODAL: SOLICITAR MOVIMENTAÇÃO ──────────────────────────────────── */}
      {showRequestModal && requestProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-verde-900">Solicitar movimentação</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {requestProduct.name} · estoque atual:{" "}
                  <strong>{requestProduct.stock ?? 0} {requestProduct.unit || "un"}</strong>
                </p>
              </div>
              <button onClick={() => setShowRequestModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleRequest} className="space-y-4">
              {/* tipo toggle */}
              <div className="flex rounded-xl border border-creme-200 overflow-hidden">
                {[
                  { value: "entrada", label: "Entrada", icon: ArrowDownCircle, active: "bg-sucesso" },
                  { value: "saida",   label: "Saída",   icon: ArrowUpCircle,   active: "bg-erro" },
                ].map(({ value, label, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReqType(value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition ${
                      reqType === value ? `${active} text-white` : "bg-white text-gray-500 hover:bg-creme-50"
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

              <p className="text-xs text-gray-400 bg-ambar-50 border border-ambar-200 rounded-xl px-4 py-3">
                A solicitação será enviada para aprovação antes de alterar o estoque.
              </p>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="md"
                  className="flex-1"
                  disabled={savingReq}
                >
                  {savingReq ? "Enviando..." : "Enviar solicitação"}
                </Button>
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
              <h2 className="text-lg font-bold text-verde-900">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="descartáveis, insumos…"
                    className={INPUT}
                    list="product-categories"
                  />
                  <datalist id="product-categories">
                    <option value="descartáveis" />
                    <option value="insumos" />
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fornecedor</label>
                  <input
                    value={form.supplier}
                    onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                    placeholder="ex: Galderma"
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Preço unit. (R$)</label>
                  <input
                    value={form.unitPrice}
                    onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
                    placeholder="0,00"
                    type="number"
                    step="any"
                    min="0"
                    className={INPUT}
                  />
                </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Lote</label>
                  <input
                    value={form.lotNumber}
                    onChange={(e) => setForm((p) => ({ ...p, lotNumber: e.target.value }))}
                    placeholder="nº do lote"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Validade</label>
                  <input
                    value={form.expiryDate}
                    onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    type="date"
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" size="md" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button size="md" onClick={saveProduct}>
                  {editingProduct ? "Salvar" : "Criar produto"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXCLUIR ────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-verde-900 mb-2">Excluir produto</h2>
            <p className="text-sm text-gray-600">
              Deseja excluir <strong>{productToDelete?.name}</strong>? O histórico de movimentações será removido.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); }}
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
