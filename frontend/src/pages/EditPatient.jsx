import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IMaskInput } from "react-imask";
import { ArrowLeft, Save, UserX } from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";
import { Card, Button } from "../components/ui";
import AlertLevelPicker from "../components/patient/AlertLevelPicker";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full border-[1.5px] border-creme-200 rounded-xl px-3.5 py-2.5 text-sm bg-creme-50 focus:outline-none focus:border-verde focus:bg-white transition";

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-bold tracking-widest text-ambar-600 font-mono uppercase mb-4">
      {children}
    </p>
  );
}

export default function EditPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", birthDate: "",
    cpf: "", rg: "", zipCode: "", street: "", city: "", state: "", country: "Brasil",
    observations: "", alertLevel: "none",
  });

  function f(field) {
    return (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  }
  function fm(field) {
    return (value) => setForm((p) => ({ ...p, [field]: value }));
  }

  useEffect(() => {
    api.get(`/patients/${id}`)
      .then((res) => {
        const p = res.data;
        setForm({
          name: p.name || "",
          phone: p.phone || "",
          email: p.email || "",
          birthDate: p.birthDate ? p.birthDate.slice(0, 10) : "",
          cpf: p.cpf || "",
          rg: p.rg || "",
          zipCode: p.zipCode || "",
          street: p.street || "",
          city: p.city || "",
          state: p.state || "",
          country: p.country || "Brasil",
          observations: p.observations || "",
          alertLevel: p.alertLevel || "none",
        });
      })
      .catch(() => toast.error("Erro ao carregar paciente"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleZipCode(value) {
    fm("zipCode")(value);
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) return;
      setForm((p) => ({
        ...p,
        street: data.logradouro || p.street,
        city: data.localidade || p.city,
        state: data.uf || p.state,
      }));
    } catch {
      toast.error("Erro ao buscar CEP");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patients/${id}`, form);
      toast.success("Paciente atualizado!");
      navigate(`/patients/${id}`);
    } catch {
      toast.error("Erro ao atualizar paciente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await api.delete(`/patients/${id}`);
      toast.success("Paciente inativado");
      navigate("/patients");
    } catch {
      toast.error("Erro ao inativar paciente");
      setDeactivating(false);
    }
  }

  if (loading) return <MainLayout><Spinner /></MainLayout>;

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(`/patients/${id}`)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border-[1.5px] border-creme-200 hover:bg-creme-100 transition"
        >
          <ArrowLeft size={16} className="text-verde-900" />
        </button>
        <div>
          <h1 className="font-serif font-light text-2xl md:text-[32px] text-verde-900">Editar paciente</h1>
          <p className="text-gray-500 text-sm mt-0.5">Atualize os dados cadastrais</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

        {/* IDENTIFICAÇÃO */}
        <Card className="bg-white! p-6 rounded-2xl">
          <SectionTitle>Identificação</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome completo">
              <input className={INPUT} value={form.name} onChange={f("name")} required placeholder="Nome completo" />
            </Field>

            <Field label="Telefone / WhatsApp">
              <IMaskInput
                mask="(00) 00000-0000"
                value={form.phone}
                onAccept={fm("phone")}
                placeholder="(00) 00000-0000"
                className={INPUT}
              />
            </Field>

            <Field label="Data de nascimento">
              <input className={INPUT} type="date" value={form.birthDate} onChange={f("birthDate")} />
            </Field>

            <Field label="E-mail">
              <input className={INPUT} type="email" value={form.email} onChange={f("email")} placeholder="email@exemplo.com" />
            </Field>

            <Field label="CPF">
              <IMaskInput
                mask="000.000.000-00"
                value={form.cpf}
                onAccept={fm("cpf")}
                placeholder="000.000.000-00"
                className={INPUT}
              />
            </Field>

            <Field label="RG">
              <IMaskInput
                mask="00.000.000-0"
                value={form.rg}
                onAccept={fm("rg")}
                placeholder="00.000.000-0"
                className={INPUT}
              />
            </Field>
          </div>
        </Card>

        {/* ENDEREÇO */}
        <Card className="bg-white! p-6 rounded-2xl">
          <SectionTitle>Endereço</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CEP">
              <IMaskInput
                mask="00000-000"
                value={form.zipCode}
                onAccept={handleZipCode}
                placeholder="00000-000"
                className={INPUT}
              />
            </Field>

            <Field label="País">
              <input className={INPUT} value={form.country} onChange={f("country")} placeholder="Brasil" />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Logradouro">
                <input className={INPUT} value={form.street} onChange={f("street")} placeholder="Rua, Avenida…" />
              </Field>
            </div>

            <Field label="Cidade">
              <input className={INPUT} value={form.city} onChange={f("city")} placeholder="Cidade" />
            </Field>

            <Field label="Estado (UF)">
              <input className={INPUT} value={form.state} onChange={f("state")} placeholder="SP" maxLength={2} />
            </Field>
          </div>
        </Card>

        {/* CUIDADOS & OBSERVAÇÕES */}
        <Card className="bg-white! p-6 rounded-2xl">
          <SectionTitle>Cuidados & Observações</SectionTitle>
          <AlertLevelPicker
            value={form.alertLevel}
            onChange={fm("alertLevel")}
          />
          <div className="mt-5">
            <Field label="Observações clínicas">
              <textarea
                className={`${INPUT} resize-none`}
                rows={4}
                value={form.observations}
                onChange={f("observations")}
                placeholder="Alergias, condições especiais, histórico relevante…"
              />
            </Field>
          </div>
        </Card>

        {/* BOTÕES SALVAR */}
        <div className="flex gap-3 flex-wrap">
          <Button type="submit" disabled={saving}>
            <Save size={15} />{saving ? "Salvando…" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(`/patients/${id}`)}>
            Cancelar
          </Button>
        </div>

        {/* ZONA DE PERIGO */}
        <div className="border border-[#EBCBC7] rounded-xl p-5 bg-[#FCF3F2]">
          <h2 className="text-sm font-bold text-erro mb-1">Zona de perigo</h2>
          <p className="text-xs text-gray-500 mb-4">
            Inativar o paciente remove-o da listagem ativa. O histórico é preservado e pode ser reativado depois em "Inativos".
          </p>

          {!confirmDeactivate ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeactivate(true)}
            >
              <UserX size={15} /> Inativar paciente
            </Button>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-erro font-medium">Tem certeza? Esta ação pode ser desfeita.</p>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="bg-erro! text-white! border-erro! hover:bg-erro!"
              >
                {deactivating ? "Inativando…" : "Sim, inativar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmDeactivate(false)}
                className="border-gray-300! text-gray-500! hover:bg-gray-50! hover:text-gray-500!"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

      </form>
    </MainLayout>
  );
}
