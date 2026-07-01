import { useEffect, useState } from "react";
import { Plus, Trash2, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

const BRANDS = ["Geral", "Visa", "Mastercard", "Elo", "American Express", "Hipercard"];
const TYPES = [
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito à vista" },
  { value: "credito_parcelado", label: "Crédito parcelado" },
];

const INPUT = "w-full border border-creme-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition";
const LABEL = "text-xs font-semibold text-gray-500 mb-1.5 block";

function typeLabel(t) {
  return TYPES.find((x) => x.value === t)?.label || t;
}

function emptyForm() {
  return { brand: "Geral", type: "credito", installmentsFrom: 2, installmentsTo: 12, percent: "" };
}

export default function CardFeesSettings() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api.get("/financial/card-fees");
      setFees(res.data || []);
    } catch {
      toast.error("Erro ao carregar taxas");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const isParcelado = form.type === "credito_parcelado";

  async function add() {
    if (form.percent === "" || Number(form.percent) < 0) {
      toast.error("Informe o percentual da taxa");
      return;
    }
    setSaving(true);
    try {
      await api.post("/financial/card-fees", {
        brand: form.brand,
        type: form.type,
        percent: Number(form.percent),
        installmentsFrom: isParcelado ? Number(form.installmentsFrom) : undefined,
        installmentsTo: isParcelado ? Number(form.installmentsTo) : undefined,
      });
      toast.success("Taxa adicionada");
      setForm(emptyForm());
      load();
    } catch {
      toast.error("Erro ao adicionar taxa");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/financial/card-fees/${id}`);
      setFees((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast.error("Erro ao remover taxa");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 bg-creme-50 border border-creme-200 rounded-2xl p-4">
        <CreditCard size={18} className="text-verde shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          Cadastre as taxas da sua maquininha por bandeira e tipo. Quando um recebimento
          for no cartão, o sistema calcula automaticamente o valor líquido (já descontada a taxa).
        </p>
      </div>

      {/* Lista de taxas */}
      <div>
        <p className="text-sm font-bold text-verde mb-3">Taxas cadastradas</p>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando…</p>
        ) : fees.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-creme-200 rounded-xl px-4 py-3">
            Nenhuma taxa cadastrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {fees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between bg-white border border-creme-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-verde">{fee.percent}%</span>
                  <div>
                    <p className="text-sm text-gray-700">
                      {typeLabel(fee.type)}
                      {fee.type === "credito_parcelado" && (
                        <span className="text-gray-400">
                          {" "}({fee.installmentsFrom}x–{fee.installmentsTo ?? "∞"}x)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{fee.brand}</p>
                  </div>
                </div>
                <button
                  onClick={() => remove(fee.id)}
                  className="text-gray-300 hover:text-red-500 transition"
                  title="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nova taxa */}
      <div className="border-t border-creme-200 pt-5">
        <p className="text-sm font-bold text-verde mb-3">Adicionar taxa</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Bandeira</label>
            <select className={INPUT} value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}>
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tipo</label>
            <select className={INPUT} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {isParcelado && (
            <>
              <div>
                <label className={LABEL}>De (parcelas)</label>
                <input type="number" min="2" className={INPUT} value={form.installmentsFrom}
                  onChange={(e) => setForm((p) => ({ ...p, installmentsFrom: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Até (parcelas)</label>
                <input type="number" min="2" className={INPUT} value={form.installmentsTo}
                  onChange={(e) => setForm((p) => ({ ...p, installmentsTo: e.target.value }))} />
              </div>
            </>
          )}
          <div>
            <label className={LABEL}>Taxa (%)</label>
            <input type="number" min="0" step="0.01" className={INPUT} value={form.percent}
              placeholder="Ex: 3.99"
              onChange={(e) => setForm((p) => ({ ...p, percent: e.target.value }))} />
          </div>
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-4 flex items-center gap-2 bg-verde hover:bg-verde-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          <Plus size={15} /> {saving ? "Adicionando…" : "Adicionar taxa"}
        </button>
      </div>

      <p className="text-[11px] text-gray-400">
        Dica: cadastre uma taxa <strong>Geral</strong> como padrão e taxas específicas por bandeira
        para sobrescrever quando necessário. Para crédito parcelado, use faixas (ex: 2x–6x e 7x–12x).
      </p>
    </div>
  );
}
