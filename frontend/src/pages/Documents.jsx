import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Eye, X, Plus, Settings2, Upload, Check } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
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
  contrato: "bg-blue-100 text-blue-700",
  termo:    "bg-amber-100 text-amber-700",
  anamnese: "bg-purple-100 text-purple-700",
  laudo:    "bg-green-100 text-green-700",
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
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", type: "termo" });
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

  useEffect(() => { loadDocs(); }, []);

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
      await api.post("/documents/upload", fd);
      toast.success("Documento adicionado");
      setShowUpload(false);
      setFile(null);
      setForm({ name: "", type: "termo" });
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

  return (
    <MainLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-verde">Pasta Sanitária</h1>
          <p className="text-gray-500 mt-1">Documentos da clínica para assinar com pacientes</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-verde hover:bg-verde-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
        >
          <Plus size={16} /> Adicionar documento
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-creme-100 rounded-xl animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 bg-creme-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText size={28} className="text-ambar" />
          </div>
          <h2 className="text-xl font-semibold text-verde mb-2">Nenhum documento</h2>
          <p className="text-gray-500 mb-6 max-w-xs">Adicione contratos, termos e anamneses para usar com os pacientes.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-verde hover:bg-verde-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
          >
            <Plus size={16} /> Adicionar documento
          </button>
        </div>
      ) : (
        <div className="bg-creme-50 border border-creme-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-creme-100 border-b border-creme-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-verde">{docs.length} {docs.length === 1 ? "documento" : "documentos"}</span>
          </div>
          <div className="divide-y divide-creme-200">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F3EEE5] transition group">
                <div className="w-9 h-9 bg-creme-100 rounded-xl flex items-center justify-center shrink-0">
                  <FileText size={17} className="text-verde" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-verde text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                    {doc.fileSize ? ` · ${formatSize(doc.fileSize)}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[doc.type] ?? TYPE_COLORS.outro}`}>
                  {DOC_TYPES.find((t) => t.value === doc.type)?.label ?? doc.type}
                </span>
                {/* Badge: campos configurados */}
                {(doc.fields ?? []).some((f) => f.type === "patient_sig") ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0 hidden sm:inline-flex items-center gap-1">
                    <Check size={10} /> Campos configurados
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 hidden sm:inline">
                    Sem campos
                  </span>
                )}

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setConfiguringDoc(doc)}
                    className="flex items-center gap-1 px-2.5 h-8 border border-ambar rounded-lg hover:bg-white transition text-xs text-verde font-medium shrink-0"
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
                    className="w-8 h-8 flex items-center justify-center border border-red-200 rounded-lg hover:bg-red-50 transition"
                    title="Excluir"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL UPLOAD */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-verde">Adicionar documento</h2>
              <button onClick={() => { setShowUpload(false); setFile(null); setForm({ name: "", type: "termo" }); }}>
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
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowUpload(false); setFile(null); setForm({ name: "", type: "termo" }); }}
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
