import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IMaskInput } from "react-imask";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";

export default function CreatePatient() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");

  const [birthDate, setBirthDate] =
    useState("");

  const [cpf, setCpf] = useState("");

  const [rg, setRg] = useState("");

  const [zipCode, setZipCode] =
    useState("");

  const [street, setStreet] =
    useState("");

  const [city, setCity] = useState("");

  const [state, setState] =
    useState("");

  const [country, setCountry] =
    useState("Brasil");

  const [observations, setObservations] =
    useState("");

  async function handleZipCode(value) {
    setZipCode(value);

    const cleanZip =
      value.replace(/\D/g, "");

    if (cleanZip.length !== 8) return;

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanZip}/json/`
      );

      const data = await response.json();

      setStreet(data.logradouro || "");

      setCity(data.localidade || "");

      setState(data.uf || "");
    } catch (error) {
      console.log(error.response);
      console.log(error.response?.data);
      console.log(error.message);

      toast.error("Erro ao buscar CEP");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await api.post("/patients", {
        name,
        phone,
        email: email || undefined,

        birthDate:
          birthDate || undefined,

        cpf,
        rg,

        zipCode,
        street,
        city,
        state,
        country,

        observations:
          observations || undefined,
      });

      toast.success("Paciente cadastrado!");
      navigate("/patients");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar paciente");
    }
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-verde">
          Novo Paciente
        </h1>

        <p className="text-gray-600 mt-1">
          Cadastre os dados do paciente.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-creme-50 border border-creme-200 rounded-2xl shadow-sm p-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-verde"
            placeholder="Nome"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
          />

          {/* Telefone */}
          <IMaskInput
            mask="(00) 00000-0000"
            value={phone}
            onAccept={(value) =>
              setPhone(value)
            }
            placeholder="Telefone"
            className="border border-ambar rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-verde"
          />

          {/* Email */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-verde"
            placeholder="E-mail"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          {/* Data nascimento */}
          <input
            type="date"
            className="border border-ambar rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-verde"
            value={birthDate}
            onChange={(e) =>
              setBirthDate(e.target.value)
            }
          />

          {/* CPF */}
          <IMaskInput
            mask="000.000.000-00"
            value={cpf}
            onAccept={(value) =>
              setCpf(value)
            }
            placeholder="CPF"
            className="border border-ambar rounded-lg p-3 bg-white"
          />

          {/* RG */}
          <IMaskInput
            mask="00.000.000-0"
            value={rg}
            onAccept={(value) =>
              setRg(value)
            }
            placeholder="RG"
            className="border border-ambar rounded-lg p-3 bg-white"
          />

          {/* CEP */}
          <IMaskInput
            mask="00000-000"
            value={zipCode}
            onAccept={(value) =>
              handleZipCode(value)
            }
            placeholder="CEP"
            className="border border-ambar rounded-lg p-3 bg-white"
          />

          {/* País */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white"
            placeholder="País"
            value={country}
            onChange={(e) =>
              setCountry(e.target.value)
            }
          />

          {/* Rua */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white md:col-span-2"
            placeholder="Logradouro"
            value={street}
            onChange={(e) =>
              setStreet(e.target.value)
            }
          />

          {/* Cidade */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white"
            placeholder="Cidade"
            value={city}
            onChange={(e) =>
              setCity(e.target.value)
            }
          />

          {/* Estado */}
          <input
            className="border border-ambar rounded-lg p-3 bg-white"
            placeholder="Estado"
            value={state}
            onChange={(e) =>
              setState(e.target.value)
            }
          />
        </div>

        {/* Observações */}
        <textarea
          className="mt-4 w-full border border-ambar rounded-lg p-3 bg-white focus:outline-none focus:ring-2 focus:ring-verde"
          placeholder="Observações"
          rows="4"
          value={observations}
          onChange={(e) =>
            setObservations(
              e.target.value
            )
          }
        />

        {/* Upload */}
        <div className="border-2 border-dashed border-ambar rounded-xl p-6 text-center mt-6 bg-white">
          <p className="text-verde font-semibold">
            Importar documentos
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Anamnese, contratos,
            consentimentos e arquivos
            clínicos
          </p>

          <input
            type="file"
            multiple
            className="mt-4"
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 mt-8">
          <button
            type="submit"
            className="bg-verde hover:bg-verde-900 text-white px-5 py-3 rounded-lg transition"
          >
            Salvar Paciente
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/patients")
            }
            className="border border-ambar text-verde px-5 py-3 rounded-lg"
          >
            Cancelar
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
