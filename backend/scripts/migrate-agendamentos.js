// ─────────────────────────────────────────────────────────────────────────────
// Migração de AGENDAMENTOS FUTUROS lidos da tela do sistema antigo (prints).
// Casa paciente por INÍCIO do nome e procedimento por nome. Hora-fim: usa a da
// tela; se ausente, deriva pela duração do procedimento (fallback 60min).
// Horários em Brasília (UTC-3) → gravados em UTC.
//
// Uso:  node scripts/migrate-agendamentos.js <email> [--commit]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "../src/config/prisma.js";

const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// category: consulta (padrão p/ paciente) | retorno | compromisso (pessoal/bloqueio)
// end: "HH:MM" opcional. Sem proc + sem end → 60min.
const AG = [
  // ── Semana 19–25/07 ──
  { date: "2026-07-21", start: "10:00", patient: "Glaucia Amélia Rissato" },
  { date: "2026-07-23", start: "10:00", patient: "Gabriela Marques" },
  { date: "2026-07-24", start: "14:00", patient: "Joelma Cristina de Frei" },
  { date: "2026-07-24", start: "14:30", end: "15:00", patient: "Nayara Cristina da Silva", proc: "HIPRO RETORNO", category: "retorno" },
  { date: "2026-07-24", start: "14:30", end: "15:00", patient: "Luana Aparecida Vilela R", proc: "Retorno", category: "retorno" },
  { date: "2026-07-24", start: "17:00", end: "17:30", patient: "Alessandra Damante Gar", proc: "HIPRO RETORNO", category: "retorno" },
  { date: "2026-07-24", start: "17:00", end: "20:00", patient: "Talita Keler Borges da Sil", proc: "Preenchimento Queixo" },
  { date: "2026-07-22", start: "09:30", end: "10:30", title: "Reunião Calixto", category: "compromisso" },

  // ── Semana 26/07–01/08 ──
  { date: "2026-07-27", start: "10:00", patient: "Marta Alves Marzagao" },
  { date: "2026-07-27", start: "16:30", end: "17:30", patient: "João Pedro Vieira Campos", proc: "Retorno", category: "retorno" },
  { date: "2026-07-28", start: "10:00", end: "11:00", title: "Unha de gel", category: "compromisso" },
  { date: "2026-07-29", start: "09:00", end: "10:00", title: "Lembrar Maíra do retoque", category: "compromisso" },
  { date: "2026-07-29", start: "17:00", end: "17:40", patient: "Isadora Lizo Limonti Lem", proc: "Avaliação" },
  { date: "2026-07-30", start: "10:30", patient: "Débora de Oliveira da C" },
  { date: "2026-07-30", start: "14:30", patient: "Ana Carolina Nascimen" },
  { date: "2026-07-31", start: "14:30", end: "15:30", patient: "Gabriela Mariana Mendonça", proc: "Preenchimento Queixo" },
  { date: "2026-07-31", start: "15:30", end: "18:30", patient: "Laura Gomes de Campos C", proc: "Preenchimento Malar" },

  // ── Ago / Set ──
  { date: "2026-08-07", start: "18:30", patient: "Isabel Cristina Garcia" },
  { date: "2026-08-31", start: "14:00", patient: "Solange de Souza Melo" },

  // ── Bloqueios ──
  { date: "2026-09-11", start: "09:00", end: "19:00", title: "Serra da canastra", category: "compromisso", allDay: true },
  { date: "2026-09-12", start: "09:00", end: "19:00", title: "Serra da canastra", category: "compromisso", allDay: true },
  { date: "2026-10-15", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
  { date: "2026-10-16", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
  { date: "2026-10-17", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
];

// Brasília (UTC-3) → Date UTC
function brToUtc(dateStr, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00-03:00`);
}
function addMin(dateStr, hhmm, min) {
  const d = brToUtc(dateStr, hhmm);
  return new Date(d.getTime() + min * 60000);
}

async function main() {
  const email = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!email) { console.error("uso: <email> [--commit]"); process.exit(1); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`sem usuário "${email}"`); process.exit(1); }

  const patients = await prisma.patient.findMany({ where: { userId: user.id }, select: { id: true, name: true } });
  const procedures = await prisma.procedure.findMany({ where: { userId: user.id }, select: { name: true, duration: true } });
  const procByName = new Map(procedures.map((p) => [norm(p.name), p]));

  console.log(`\nDestino: ${user.email} — ${patients.length} pacientes, ${procedures.length} procedimentos`);
  console.log(commit ? "🟢 COMMIT\n" : "🟡 DRY-RUN (use --commit)\n");

  const rows = [];
  const problemas = [];

  for (const a of AG) {
    let patientId = null, patientName = null, ambiguo = false;
    if (a.patient) {
      const alvo = norm(a.patient);
      const matches = patients.filter((p) => norm(p.name).startsWith(alvo) || norm(p.name) === alvo);
      if (matches.length === 1) { patientId = matches[0].id; patientName = matches[0].name; }
      else if (matches.length > 1) { ambiguo = true; patientName = `AMBÍGUO (${matches.length}): ${matches.map(m=>m.name).join(" | ")}`; }
      else { patientName = `NÃO ENCONTRADO: ${a.patient}`; }
    }

    // duração
    let endMin = null;
    if (a.end) {
      const s = brToUtc(a.date, a.start), e = brToUtc(a.date, a.end);
      endMin = Math.round((e - s) / 60000);
    } else if (a.proc && procByName.get(norm(a.proc))?.duration) {
      endMin = procByName.get(norm(a.proc)).duration;
    } else {
      endMin = 60;
    }

    const startsAt = brToUtc(a.date, a.start);
    const endsAt = a.end ? brToUtc(a.date, a.end) : addMin(a.date, a.start, endMin);
    const category = a.category || (a.patient ? "consulta" : "compromisso");
    const title = a.title || a.patient || "Agendamento";

    if (a.patient && !patientId) problemas.push(`${a.date} ${a.start} → ${patientName}`);

    rows.push({ a, patientId, patientName, startsAt, endsAt, category, title, ambiguo });

    const patStr = a.patient ? (patientId ? `✓ ${patientName}` : `✗ ${patientName}`) : "(compromisso)";
    console.log(`  ${a.date} ${a.start}-${a.end || `+${endMin}m`}  ${(a.proc||"—").padEnd(24)} ${patStr}`);

    // Pula: ambíguos E pacientes não encontrados (a.patient definido mas sem match).
    const pular = ambiguo || (a.patient && !patientId);
    if (commit && !pular) {
      await prisma.appointment.create({
        data: {
          title,
          startsAt, endsAt,
          category,
          status: "SCHEDULED",
          isAllDay: !!a.allDay,
          procedureType: a.proc || null,
          patient: patientId ? { connect: { id: patientId } } : undefined,
          user: { connect: { id: user.id } },
        },
      });
    }
  }

  console.log(`\n📊 ${rows.length} agendamentos · ${rows.filter(r=>r.patientId).length} c/ paciente casado · ${rows.filter(r=>!r.a.patient).length} compromissos`);
  if (problemas.length) {
    console.log(`\n⚠️ Pacientes não casados (${problemas.length}) — revisar:`);
    problemas.forEach((p) => console.log(`   - ${p}`));
  }
  const amb = rows.filter(r=>r.ambiguo);
  if (amb.length) { console.log(`\n⚠️ AMBÍGUOS (${amb.length}) — NÃO gravados:`); amb.forEach(r=>console.log(`   - ${r.a.date} ${r.a.start}: ${r.patientName}`)); }
  console.log(commit ? "\n✅ Gravado.\n" : "\nℹ️  --commit p/ gravar.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
