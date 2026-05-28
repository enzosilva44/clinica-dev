import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import Spinner from "../components/ui/Spinner";
import api from "../services/api";

export default function EditPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    api.get(`/patients/${id}`)
      .then((res) => {
        setName(res.data.name || "");
        setEmail(res.data.email || "");
        setPhone(res.data.phone || "");
      })
      .catch(() => toast.error("Erro ao carregar paciente"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.put(`/patients/${id}`, { name, email, phone });
      toast.success("Paciente atualizado!");
      navigate(`/patients/${id}`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar paciente");
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <Spinner />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#314D3E]">Editar Paciente</h1>
        <p className="text-gray-500 mt-1">Atualize os dados do paciente.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-8 max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#314D3E] mb-1">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#D6C1A3] rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#314D3E] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#D6C1A3] rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#314D3E] mb-1">Telefone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-[#D6C1A3] rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#314D3E]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            type="submit"
            className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-3 rounded-xl transition"
          >
            Salvar alterações
          </button>
          <button
            type="button"
            onClick={() => navigate(`/patients/${id}`)}
            className="border border-[#D6C1A3] text-[#314D3E] px-5 py-3 rounded-xl"
          >
            Cancelar
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
