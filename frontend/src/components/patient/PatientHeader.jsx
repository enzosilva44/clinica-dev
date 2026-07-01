export default function PatientHeader({ patient, onBack }) {
  return (
    <div className="bg-verde rounded-2xl p-6 mb-6 text-white shadow-sm">
      <button
        onClick={onBack}
        className="mb-4 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition"
      >
        ← Voltar
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {patient.name}
          </h1>

          <div className="flex gap-8 mt-3 text-sm text-white/90">
            <div>
              <p className="text-white/60">Telefone</p>
              <p>{patient.phone || "-"}</p>
            </div>

            <div>
              <p className="text-white/60">Nascimento</p>
              <p>
                {patient.birthDate
                  ? new Date(patient.birthDate).toLocaleDateString("pt-BR")
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-white/60">Cidade</p>
              <p>{patient.city || "-"}</p>
            </div>
          </div>
        </div>

        <button className="bg-[#D8C3A5] text-verde px-4 py-2 rounded-lg font-medium">
          Editar dados
        </button>
      </div>
    </div>
  );
}