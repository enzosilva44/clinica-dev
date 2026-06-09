import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, X, ZoomIn, ImageOff } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function photoUrl(id) {
  const token = localStorage.getItem("token");
  return `${API_BASE}/photos/${id}/file?token=${encodeURIComponent(token ?? "")}`;
}

function groupByDate(photos) {
  const groups = {};
  for (const p of photos) {
    const key = new Date(p.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups);
}

export default function PatientPhotos({ patientId }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  async function load() {
    try {
      const res = await api.get(`/photos/patient/${patientId}`);
      setPhotos(res.data);
    } catch {
      toast.error("Erro ao carregar fotos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [patientId]);

  async function handleFiles(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return toast.error("Apenas imagens são permitidas");
    setUploading(true);
    try {
      const fd = new FormData();
      images.forEach((f) => fd.append("photos", f));
      await api.post(`/photos/patient/${patientId}`, fd);
      toast.success(`${images.length} foto${images.length > 1 ? "s" : ""} adicionada${images.length > 1 ? "s" : ""}`);
      load();
    } catch {
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Excluir esta foto?")) return;
    try {
      await api.delete(`/photos/${id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (lightbox?.id === id) setLightbox(null);
      toast.success("Foto excluída");
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  const groups = groupByDate(photos);

  return (
    <div className="bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl overflow-hidden">

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl mx-5 mt-5 p-8 text-center cursor-pointer transition-all ${
          dragging
            ? "border-[#1F4D46] bg-[#E8E0D2]"
            : "border-[#C2A56B] hover:border-[#1F4D46]/40 hover:bg-white"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[#1F4D46]/30 border-t-[#1F4D46] rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Enviando fotos…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#E8E0D2] flex items-center justify-center">
              <Upload size={18} className="text-[#1F4D46]" />
            </div>
            <p className="text-sm font-medium text-[#1F4D46]">
              Arraste fotos ou clique para selecionar
            </p>
            <p className="text-xs text-gray-400">JPG, PNG, WebP · até 15 MB · múltiplas de uma vez</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-[#E8E0D2] rounded-xl animate-pulse" />)}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#E8E0D2] flex items-center justify-center">
              <ImageOff size={22} className="text-[#C2A56B]" />
            </div>
            <p className="text-sm text-gray-400">Nenhuma foto ainda. Faça o upload acima.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map(([date, items]) => (
              <div key={date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-[#1F4D46] uppercase tracking-wide whitespace-nowrap">
                    {date}
                  </span>
                  <div className="flex-1 h-px bg-[#D8CDB9]" />
                  <span className="text-xs text-gray-400 shrink-0">
                    {items.length} foto{items.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Photos grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {items.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square rounded-xl overflow-hidden bg-[#E8E0D2]">
                      <img
                        src={photoUrl(photo.id)}
                        alt={photo.fileName}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />

                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); setLightbox(photo); }}
                          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition"
                        >
                          <ZoomIn size={14} className="text-[#1F4D46]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                          className="w-8 h-8 rounded-full bg-white/90 hover:bg-red-50 flex items-center justify-center transition"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>

                      {/* Time caption */}
                      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                        <p className="text-white text-[10px] font-medium">
                          {new Date(photo.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            onClick={() => setLightbox(null)}
          >
            <X size={18} className="text-white" />
          </button>

          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoUrl(lightbox.id)}
              alt={lightbox.fileName}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="text-center">
              <p className="text-white/80 text-sm font-medium">{lightbox.fileName}</p>
              <p className="text-white/50 text-xs mt-0.5">
                {new Date(lightbox.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
