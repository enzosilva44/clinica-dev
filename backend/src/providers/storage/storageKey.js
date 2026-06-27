import path from "path";

// Gera um carimbo de data/hora legível em horário de Brasília: 2026-06-27_153045
function readableTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    year: p.year,
    month: p.month,
    stamp: `${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}${p.second}`,
  };
}

// Monta uma key de storage organizada:
//   {type}/{clinicId}/{patientId?}/{ano}/{mes}/{data-hora}-{rand}{.ext}
// patientId é opcional (documentos-modelo não têm paciente).
export function buildStorageKey({ type, clinicId, patientId, originalName, defaultExt = "" }) {
  const { year, month, stamp } = readableTimestamp();
  const rand = Math.round(Math.random() * 1e6)
    .toString()
    .padStart(6, "0");
  const extension = path.extname(originalName || "") || defaultExt;
  const fileName = `${stamp}-${rand}${extension}`;

  const segments = [type, clinicId];
  if (patientId) segments.push(patientId);
  segments.push(year, month, fileName);

  return path.posix.join(...segments);
}
