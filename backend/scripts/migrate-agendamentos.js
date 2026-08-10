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
// Fonte: prints da agenda do sistema antigo enviados em 10/08/2026 (semanas
// 20/07 → 24/10). Substituem a coleta de julho — a agenda mudou desde então.
const AG = [
  // ── Semana 20–25/07 ──
  { date: "2026-07-20", start: "09:30", title: "Compromisso Pessoal", category: "compromisso" },
  { date: "2026-07-22", start: "09:30", end: "10:30", title: "Reunião Calixto", category: "compromisso" },
  { date: "2026-07-22", start: "11:00", end: "12:00", patient: "Lucia Elena Moris", proc: "Toxina Botulínica 3 regiões" },
  { date: "2026-07-22", start: "13:00", end: "14:00", title: "Nariz botolifting", category: "compromisso" },
  { date: "2026-07-22", start: "14:00", end: "15:00", patient: "Ledinilde Ramos de Souza Silva", proc: "Toxina Botulínica 3 regiões" },
  { date: "2026-07-22", start: "15:00", end: "16:00", patient: "Luciana De Jesus", proc: "Toxina Botulínica 3 regiões" },
  { date: "2026-07-22", start: "15:30", end: "16:30", patient: "Talia Becari da Silva", proc: "Toxina Botulínica 3 regiões" },
  { date: "2026-07-24", start: "14:00", patient: "Daiana Herrer" },
  { date: "2026-07-24", start: "14:30", patient: "Luana Aparec" },
  { date: "2026-07-24", start: "15:55", patient: "Joelma Cristina de Freitas Santos" },

  // ── Semana 27/07–01/08 ──
  { date: "2026-07-27", start: "14:00", title: "Compromisso Pessoal", category: "compromisso" },
  { date: "2026-07-28", start: "10:00", end: "11:00", title: "Unha de gel", category: "compromisso" },
  { date: "2026-07-28", start: "12:00", end: "13:00", title: "Pegar coisas Glaucia e botox Marta", category: "compromisso" },
  { date: "2026-07-28", start: "15:00", end: "16:00", title: "Ver ap", category: "compromisso" },
  { date: "2026-07-29", start: "15:30", patient: "Glaucia Amélia Rissato" },
  { date: "2026-07-29", start: "16:30", patient: "Marta Alves Marzagao" },
  { date: "2026-07-30", start: "10:00", patient: "Isadora Lizo L" },
  { date: "2026-07-30", start: "10:30", patient: "Débora de Oli" },
  { date: "2026-07-30", start: "12:30", end: "13:30", patient: "Maria Teresa da Costa Andrade", proc: "PEIM" },
  { date: "2026-07-31", start: "10:30", end: "11:30", patient: "Marianee Alves Pereira", proc: "Preenchimento labial" },
  { date: "2026-07-31", start: "14:30", end: "15:30", patient: "Gabriela Mariana Mendonça", proc: "Preenchimento Queixo" },
  { date: "2026-08-01", start: "10:00", patient: "Zilda Françolim Barros" },

  // ── Semana 03–08/08 ──
  { date: "2026-08-03", start: "14:00", end: "15:00", title: "Médico", category: "compromisso" },
  { date: "2026-08-03", start: "17:00", patient: "Grasiela Grandi" },
  { date: "2026-08-05", start: "09:00", patient: "Ledinilde Ramos de Souza Silva" },
  { date: "2026-08-05", start: "11:00", end: "12:00", patient: "Solange de Souza Melo", proc: "Toxina Botulínica 3 regiões + Preenchimento labial" },
  { date: "2026-08-05", start: "13:10", end: "14:10", patient: "Regislaine dos Santos", proc: "PEIM" },
  { date: "2026-08-05", start: "15:00", patient: "Caroline Crist" },
  { date: "2026-08-05", start: "15:10", title: "Compromisso Pessoal", category: "compromisso" },
  { date: "2026-08-05", start: "16:00", end: "17:00", title: "Hidratação angelita", category: "compromisso" },
  { date: "2026-08-05", start: "17:00", patient: "Lucia Elena Moris" },
  { date: "2026-08-06", start: "15:30", patient: "Luciana De Jesus Costa" },
  { date: "2026-08-06", start: "17:30", patient: "Talia Becari da Silva" },
  { date: "2026-08-06", start: "18:42", end: "19:42", patient: "Laura Luiza Dias Souza", proc: "Toxina Botulínica 3 regiões" },
  { date: "2026-08-07", start: "09:00", end: "10:00", title: "Liberação", category: "compromisso" },
  { date: "2026-08-07", start: "12:30", end: "13:30", patient: "Maíra Xavier Cintra", proc: "PEIM + Toxina Botulínica Masseter" },
  { date: "2026-08-07", start: "13:30", title: "Compromisso Pessoal", category: "compromisso" },
  { date: "2026-08-07", start: "14:00", end: "15:30", patient: "Laura Gomes de", proc: "Preenchimento Malar" },
  { date: "2026-08-07", start: "15:05", end: "16:05", patient: "Laura Gomes de", proc: "Retorno", category: "retorno" },
  { date: "2026-08-07", start: "16:00", patient: "Elaine Cristina Correia" },

  // ── Semana 10–15/08 ──
  { date: "2026-08-10", start: "12:30", patient: "Ana laura França Santana" },
  { date: "2026-08-10", start: "13:00", end: "18:00", title: "Captação conteúdo", category: "compromisso" },
  { date: "2026-08-11", start: "09:00", end: "19:00", title: "Atender Ipuã", category: "compromisso", allDay: true },
  { date: "2026-08-13", start: "14:00", end: "15:00", patient: "Ana Carolina Guimarães", proc: "Preenchimento labial" },
  { date: "2026-08-13", start: "16:00", patient: "Giovana Araújo" },
  { date: "2026-08-13", start: "17:00", end: "23:00", patient: "Caroline Cristina Vieira de Souza", proc: "Toxina Botulínica 3 regiões + Preenchimento Malar" },
  { date: "2026-08-14", start: "15:00", patient: "Josilene Cristina dos Santos Pereira" },
  { date: "2026-08-14", start: "16:00", patient: "Laura Gomes de Campos Castro" },
  { date: "2026-08-14", start: "17:00", patient: "João Pedro Vieira Campos" },
  { date: "2026-08-14", start: "18:30", patient: "Isabel Cristina Ferreira" },

  // ── Semana 17–22/08 ──
  { date: "2026-08-17", start: "10:30", end: "11:30", patient: "Camila Cristiane Ferreira Bandeira", proc: "Preenchimento labial" },
  { date: "2026-08-18", start: "10:00", patient: "Glaucia Amélia Rissato" },
  { date: "2026-08-20", start: "09:30", patient: "Laura Luiza Dias Souza" },
  { date: "2026-08-20", start: "10:00", patient: "Solange de Souza Melo" },
  { date: "2026-08-20", start: "10:30", patient: "Débora de Oliveira da Cunha" },
  { date: "2026-08-21", start: "14:00", end: "15:00", patient: "Laura Gomes de Campos Castro", proc: "Retorno", category: "retorno" },

  // ── Semana 24–29/08 ──
  { date: "2026-08-25", start: "10:00", end: "11:00", title: "Compromisso Pessoal", category: "compromisso" },
  { date: "2026-08-29", start: "13:00", patient: "Daiana Herrera" },
  { date: "2026-08-29", start: "13:30", end: "14:30", patient: "Luciana Maria Ferreira Penha", proc: "HIPRO FULL FACE" },
  { date: "2026-08-29", start: "14:30", end: "15:30", patient: "Eliana Aparecida Lemes Oliveira Teodoro", proc: "HIPRO PESCOÇO" },
  { date: "2026-08-29", start: "15:30", patient: "Júlia Santana Ferreira" },
  { date: "2026-08-29", start: "16:15", end: "17:15", patient: "Sabrina Carla Garcia de Barros", proc: "HIPRO FULL FACE" },
  { date: "2026-08-29", start: "17:15", patient: "Roberta Aguiar da Silva" },

  // ── Semana 31/08–05/09 ──
  { date: "2026-08-31", start: "14:00", patient: "Solange de Souza Melo" },
  { date: "2026-09-02", start: "13:30", end: "14:30", patient: "Regislaine dos Santos", proc: "PEIM" },
  { date: "2026-09-03", start: "12:30", end: "13:30", patient: "Maria Teresa da Costa Andrade", proc: "PEIM" },

  // ── Set / Out ──
  { date: "2026-09-11", start: "09:00", end: "19:00", title: "Serra da canastra", category: "compromisso", allDay: true },
  { date: "2026-09-12", start: "09:00", end: "19:00", title: "Serra da canastra", category: "compromisso", allDay: true },
  { date: "2026-10-15", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
  { date: "2026-10-16", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
  { date: "2026-10-17", start: "09:00", end: "19:00", title: "Praia", category: "compromisso", allDay: true },
  { date: "2026-10-23", start: "17:00", end: "18:00", patient: "Grasiela Grandi", proc: "Toxina Botulínica 3 regiões", notes: "Botox brinde" },
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
      // Chave estável (conta + data/hora + quem) → re-rodar não duplica.
      const idempotencyKey = `migr:${user.id}:${a.date}T${a.start}:${norm(a.patient || a.title || "")}`;
      const dados = {
        title,
        startsAt, endsAt,
        category,
        status: "SCHEDULED",
        isAllDay: !!a.allDay,
        procedureType: a.proc || null,
        notes: a.notes || null,
        patient: patientId ? { connect: { id: patientId } } : undefined,
        user: { connect: { id: user.id } },
      };
      await prisma.appointment.upsert({
        where: { idempotencyKey },
        update: dados,
        create: { ...dados, idempotencyKey },
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
