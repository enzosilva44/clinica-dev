import { AlertTriangle } from "lucide-react";
import { getAlertLevel } from "./alertLevels";

export default function PatientHeader({ patient, onBack }) {
  const level = patient.alertLevel && patient.alertLevel !== "none"
    ? getAlertLevel(patient.alertLevel)
    : null;

  return (
    <>
    {level && (
      <div className={`flex items-start gap-3 rounded-2xl border p-4 mb-4 ${level.banner}`}>
        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm">{level.short}</p>
          <p className="text-sm mt-0.5 whitespace-pre-line">
            {patient.observations?.trim() || "Este paciente possui um alerta ativo. Revise as observações clínicas."}
          </p>
        </div>
      </div>
    )}
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
    </>
  );
}