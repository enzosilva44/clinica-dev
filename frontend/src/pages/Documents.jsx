import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Eye, X, Plus, Settings2, Upload, Check, Folder, FolderPlus } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card, Button } from "../components/ui";
import api from "../services/api";
import toast from "react-hot-toast";
import FieldPlacementModal from "../components/documents/FieldPlacementModal";

const DOC_TYPES = [
  { value: "contrato", label: "Contrato" },
  { value: "termo", label: "Termo" },
  { value: "anamnese", label: "Anamnese" },
  { value: "laudo", label: "Laudo" },
  { value: "outro", label: "Outro" },
];

const TYPE_COLORS = {
  contrato: "bg-info/15 text-info",
  termo:    "bg-[#FAF0E4] text-ambar-600",
  anamnese: "bg-ia/15 text-ia",
  laudo:    "bg-sucesso/15 text-sucesso",
  outro:    "bg-gray-100 text-gray-500",
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name ?? "");
}

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState("all"); // "all" | "none" | folderId
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", type: "termo", folderId: "" });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [configuringDoc, setConfiguringDoc] = useState(null);
  const fileRef = useRef();

  async function loadDocs() {
    try {
      const res = await api.get("/documents");
      setDocs(res.data);
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }

  async function loadFolders() {
    try {
      const res = await api.get("/documents/folders");
      setFolders(res.data);
    } catch {
      toast.error("Erro ao carregar pastas");
    }
  }

  useEffect(() => { loadDocs(); loadFolders(); }, []);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const res = await api.post("/documents/folders", { name });
      setFolders((prev) => [...prev, res.data]);
      setNewFolderName("");
      setShowNewFolder(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar pasta");
    }
  }

  async function deleteFolder(id) {
    if (!confirm("Excluir esta pasta? Os documentos voltam para 'Sem pasta'.")) return;
    try {
      await api.delete(`/documents/folders/${id}`);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setDocs((prev) => prev.map((d) => d.folderId === id ? { ...d, folderId: null } : d));
      if (activeFolder === id) setActiveFolder("all");
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao excluir pasta");
    }
  }

  async function moveDoc(docId, folderId) {
    try {
      await api.put(`/documents/${docId}`, { folderId: folderId || null });
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, folderId: folderId || null } : d));
    } catch {
      toast.error("Erro ao mover documento");
    }
  }

  const visibleDocs = docs.filter((d) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "none") return !d.folderId;
    return d.folderId === activeFolder;
  });

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (isPdf(f)) {
      setFile(f);
      if (!form.name) setForm((p) => ({ ...p, name: f.name.replace(/\.pdf$/i, "") }));
    } else {
      toast.error("Apenas arquivos PDF são aceitos");
    }
  }

  async function handleUpload() {
    if (!file) return toast.error("Selecione um arquivo PDF");
    if (!form.name.trim()) return toast.error("Informe o nome do documento");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", form.name.trim());
      fd.append("type", form.type);
      if (form.folderId) fd.append("folderId", form.folderId);
      await api.post("/documents/upload", fd);
      toast.success("Documento adicionado");
      setShowUpload(false);
      setFile(null);
      setForm({ name: "", type: "termo", folderId: activeFolder !== "all" && activeFolder !== "none" ? activeFolder : "" });
      loadDocs();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Excluir este documento? Os pacientes vinculados perderão o acesso.")) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success("Documento excluído");
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  function openFile(id) {
    const token = localStorage.getItem("token");
    const base = import.meta.env.VITE_API_URL || "http://localhost:3000";
    window.open(`${base}/documents/${id}/file?token=${token}`, "_blank");
  }

  const activeFolderObj = folders.find((f) => f.id === activeFolder);
  const pageTitle = activeFolder === "all" ? "Documentos" : activeFolder === "none" ? "Sem pasta" : (activeFolderObj?.name ?? "Documentos");

  return (
    <MainLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">{pageTitle}</h1>
          <p className="text-gray-500 mt-1">Documentos da clínica para assinar com pacientes</p>
        </div>
        <Button size="md" onClick={() => setShowUpload(true)}>
          <Plus size={16} /> Adicionar documento
        </Button>
      </div>

      {/* PASTAS */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <button
          onClick={() => setActiveFolder("all")}
          className={`px-3.5 py-2 rounded-full text-[13px] font-bold border-[1.5px] transition ${
            activeFolder === "all" ? "bg-verde-50 text-verde border-verde-200" : "bg-creme-50 border-creme-200 text-gray-500 hover:border-verde/30"
          }`}
        >
          Todos
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              onClick={() => setActiveFolder(folder.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border-[1.5px] transition ${
                activeFolder === folder.id ? "bg-verde-50 text-verde border-verde-200" : "bg-creme-50 border-creme-200 text-gray-500 hover:border-verde/30"
              }`}
            >
              <Folder size={12} /> {folder.name}
            </button>
            {!folder.isDefault && (
              <button
                onClick={() => deleteFolder(folder.id)}
                title="Excluir pasta"
                className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-erro/15 text-erro items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition ${
                  activeFolder === folder.id ? "hidden" : "hidden group-hover:flex"
                }`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setActiveFolder("none")}
          className={`px-3.5 py-2 rounded-full text-[13px] font-bold border-[1.5px] transition ${
            activeFolder === "none" ? "bg-verde-50 text-verde border-verde-200" : "bg-creme-50 border-creme-200 text-gray-500 hover:border-verde/30"
          }`}
        >
          Sem pasta
        </button>

        {showNewFolder ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
              placeholder="Nome da pasta"
              className="border border-ambar rounded-lg px-2.5 py-1.5 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
            <button onClick={createFolder} className="text-xs text-verde font-bold px-2 py-1.5">OK</button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-gray-400 hover:text-gray-600 transition px-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold border-[1.5px] border-dashed border-ambar-300 text-verde hover:border-verde transition"
          >
            <FolderPlus size={12} /> Nova pasta
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-creme-100 rounded-xl animate-pulse" />)}
        </div>
      ) : visibleDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText size={28} className="text-ambar" />
          </div>
          <h2 className="text-xl font-semibold text-verde-900 mb-2">Nenhum documento</h2>
          <p className="text-gray-500 mb-6 max-w-xs">Adicione contratos, termos e anamneses para usar com os pacientes.</p>
          <Button onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Adicionar documento
          </Button>
        </div>
      ) : (
        <Card className="bg-white! p-0 overflow-hidden">
          <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200 flex items-center justify-between">
            <span className="text-sm font-bold text-verde-900">{visibleDocs.length} {visibleDocs.length === 1 ? "documento" : "documentos"}</span>
          </div>
          <div className="divide-y divide-creme-200">
            {visibleDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-creme-50 transition group">
                <div className="w-9 h-9 bg-creme-100 rounded-xl flex items-center justify-center shrink-0">
                  <FileText size={17} className="text-ambar-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-verde-900 text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                    {doc.fileSize ? ` · ${formatSize(doc.fileSize)}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[doc.type] ?? TYPE_COLORS.outro}`}>
                  {DOC_TYPES.find((t) => t.value === doc.type)?.label ?? doc.type}
                </span>
                {/* Badge: campos configurados */}
                {(doc.fields ?? []).some((f) => f.type === "patient_sig") ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sucesso/15 text-sucesso shrink-0 hidden sm:inline-flex items-center gap-1">
                    <Check size={10} /> Campos configurados
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF0E4] text-ambar-600 shrink-0 hidden sm:inline">
                    Sem campos
                  </span>
                )}

                <select
                  value={doc.folderId ?? ""}
                  onChange={(e) => moveDoc(doc.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-ambar rounded-lg px-2 py-1.5 bg-white shrink-0 opacity-0 group-hover:opacity-100 transition max-w-35"
                  title="Mover para pasta"
                >
                  <option value="">Sem pasta</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setConfiguringDoc(doc)}
                    className="flex items-center gap-1 px-2.5 h-8 border border-ambar rounded-lg hover:bg-white transition text-xs text-verde font-semibold shrink-0"
                    title="Configurar campos de assinatura"
                  >
                    <Settings2 size={13} /> Campos
                  </button>
                  <button
                    onClick={() => openFile(doc.id)}
                    className="w-8 h-8 flex items-center justify-center border border-ambar rounded-lg hover:bg-white transition"
                    title="Visualizar"
                  >
                    <Eye size={14} className="text-verde" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="w-8 h-8 flex items-center justify-center border border-[#EBCBC7] rounded-lg hover:bg-erro/10 transition"
                    title="Excluir"
                  >
                    <Trash2 size={14} className="text-erro" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL UPLOAD */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-verde">Adicionar documento</h2>
              <button onClick={() => { setShowUpload(false); setFile(null); setForm({ name: "", type: "termo", folderId: "" }); }}>
                <X size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  dragging ? "border-verde bg-creme-100" : file ? "border-verde/40 bg-creme-50" : "border-ambar hover:border-verde/40"
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (!isPdf(f)) {
                    toast.error("Apenas arquivos PDF são aceitos");
                    e.target.value = "";
                    return;
                  }
                  setFile(f);
                  if (!form.name) setForm((p) => ({ ...p, name: f.name.replace(/\.pdf$/i, "") }));
                }} />
                {file ? (
                  <>
                    <FileText size={28} className="text-verde mx-auto mb-2" />
                    <p className="text-sm font-semibold text-verde truncate">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatSize(file.size)}</p>
                  </>
                ) : (
                  <>
                    <Upload size={28} className="text-ambar mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Arraste o PDF ou clique para selecionar</p>
                    <p className="text-xs text-gray-400 mt-1">Máximo 20 MB</p>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Nome do documento</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Contrato de Prestação de Serviços"
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, type: t.value }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                        form.type === t.value
                          ? "bg-verde text-white border-verde"
                          : "border-ambar text-verde hover:bg-creme-100"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Pasta</label>
                <select
                  value={form.folderId}
                  onChange={(e) => setForm((p) => ({ ...p, folderId: e.target.value }))}
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                >
                  <option value="">Sem pasta</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowUpload(false); setFile(null); setForm({ name: "", type: "termo", folderId: "" }); }}
                className="border border-ambar px-4 py-2 rounded-xl text-sm hover:bg-creme-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="bg-verde hover:bg-verde-900 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
              >
                {uploading ? "Enviando…" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIELD PLACEMENT MODAL */}
      {configuringDoc && (
        <FieldPlacementModal
          patientDoc={{ document: configuringDoc }}
          onClose={() => setConfiguringDoc(null)}
          onSaved={(fields) => {
            setDocs((prev) =>
              prev.map((d) => d.id === configuringDoc.id ? { ...d, fields } : d)
            );
            setConfiguringDoc(null);
          }}
        />
      )}
    </MainLayout>
  );
}
