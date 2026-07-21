import { useState } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";

function maskPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.length > 10
    ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

const INPUT = "w-full border border-creme-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition";
const LABEL = "text-xs font-semibold text-gray-500 mb-1.5 block";

// Modal de captura do lead antes de abrir a demo.
// Nome e telefone obrigatórios; e-mail opcional.
export default function LeadCaptureModal({ open, loading, erro, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  if (!open) return null;

  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() || null });
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition disabled:opacity-40"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-black text-[#141414] mb-1">Vamos abrir sua demonstração</h2>
        <p className="text-sm text-gray-500 mb-5">Só precisamos de um contato para você começar.</p>

        <form onSubmit={handleSubmit}>
          <label className={LABEL}>Nome *</label>
          <input className={INPUT} placeholder="Seu nome" value={name}
            onChange={(e) => setName(e.target.value)} autoFocus />

          <label className={`${LABEL} mt-4`}>WhatsApp / Telefone *</label>
          <input className={INPUT} inputMode="tel" placeholder="(11) 99999-9999" value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))} />

          <label className={`${LABEL} mt-4`}>E-mail</label>
          <input className={INPUT} type="email" placeholder="voce@clinica.com" value={email}
            onChange={(e) => setEmail(e.target.value)} />

          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

          <button type="submit" disabled={!canSubmit || loading}
            className="mt-5 w-full bg-verde hover:bg-verde-900 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
            {loading
              ? (<><Loader2 size={16} className="animate-spin" /> Abrindo demonstração…</>)
              : (<>Entrar na demonstração <ChevronRight size={16} /></>)}
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-3">
            Sem cartão de crédito. Os dados de teste são apagados depois.
          </p>
        </form>
      </div>
    </div>
  );
}
