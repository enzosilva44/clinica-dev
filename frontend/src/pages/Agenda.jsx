import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Plus, X, Trash2, Calendar, MessageSquare, TrendingUp, TrendingDown, DollarSign, Check } from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import { Card } from "../components/ui";
import CalendarSidebar from "../components/calendar/CalendarSidebar";
import "../components/calendar/calendar.css";
import api from "../services/api";
import { useFeatures } from "../hooks/useFeatures";

const PROFESSIONALS = ["Dra Ana", "Dra Julia", "Dra Camila"];
const PROFESSIONAL_COLORS = {
  "Dra Ana":    "#00704A",
  "Dra Julia":  "#6F7F73",
  "Dra Camila": "#C4895A",
};
const STATUS_COLORS = {
  SCHEDULED:   "#C4895A",
  CONFIRMED:   "#4A8EC2",
  IN_PROGRESS: "#D4A017",
  FINISHED:    "#3A9B6F",
  CANCELED:    "#B05248",
};
const CATEGORY_COLORS = {
  consulta:    "#00704A",
  retorno:     "#2E6FA8",
  lembrete:    "#C4895A",
  compromisso: "#6F7F73",
  bloqueio:    "#8A8A8A",
  receivable:  "#1E9E5A",
  payable:     "#D9534F",
};
// Tipos escolhidos no início da criação de um evento
const APPOINTMENT_TYPES = [
  { key: "consulta",    label: "Consulta" },
  { key: "retorno",     label: "Retorno" },
  { key: "lembrete",    label: "Lembrete" },
  { key: "compromisso", label: "Compromisso" },
  { key: "bloqueio",    label: "Bloqueio" },
];
// Tipos "simples" (sem paciente/financeiro/status/whatsapp)
const SIMPLE_TYPES = ["lembrete", "compromisso", "bloqueio"];
const RECURRENCE_OPTIONS = [
  { key: "none",     label: "Não repetir" },
  { key: "DAILY",    label: "Diária" },
  { key: "WEEKLY",   label: "Semanal" },
  { key: "BIWEEKLY", label: "Quinzenal" },
  { key: "MONTHLY",  label: "Mensal" },
];

// Monta a string RRULE a partir da frequência escolhida.
function buildRecurrenceRule(freq, until) {
  if (!freq || freq === "none") return null;
  const map = {
    DAILY:    "FREQ=DAILY;INTERVAL=1",
    WEEKLY:   "FREQ=WEEKLY;INTERVAL=1",
    BIWEEKLY: "FREQ=WEEKLY;INTERVAL=2",
    MONTHLY:  "FREQ=MONTHLY;INTERVAL=1",
  };
  let rule = map[freq];
  if (!rule) return null;
  if (until) {
    // UNTIL no formato YYYYMMDD (fim do dia)
    const d = new Date(until);
    if (!isNaN(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      rule += `;UNTIL=${y}${m}${day}T235959Z`;
    }
  }
  return rule;
}

// Data no formato do DTSTART do rrule (UTC): YYYYMMDDTHHMMSSZ
function toRRuleDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Deriva a frequência (para o form de edição) a partir de um RRULE.
function parseRecurrenceFreq(rule) {
  if (!rule) return "none";
  if (rule.includes("FREQ=DAILY")) return "DAILY";
  if (rule.includes("FREQ=MONTHLY")) return "MONTHLY";
  if (rule.includes("FREQ=WEEKLY")) return rule.includes("INTERVAL=2") ? "BIWEEKLY" : "WEEKLY";
  return "none";
}
const CATEGORY_FILTERS = [
  { key: "consulta",    label: "Consultas" },
  { key: "retorno",     label: "Retornos" },
  { key: "lembrete",    label: "Lembretes" },
  { key: "compromisso", label: "Compromissos" },
  { key: "bloqueio",    label: "Bloqueios" },
  { key: "receivable",  label: "A receber" },
  { key: "payable",     label: "A pagar" },
];
const STATUS_OPTIONS = [
  { value: "SCHEDULED",   label: "Agendado" },
  { value: "CONFIRMED",   label: "Confirmado" },
  { value: "IN_PROGRESS", label: "Em atendimento" },
  { value: "FINISHED",    label: "Concluído" },
  { value: "CANCELED",    label: "Cancelado" },
];

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência"];

function emptyForm() {
  return {
    title: "",
    category: "consulta",
    description: "",
    patientId: "",
    professional: "Dra Ana",
    procedureType: "",
    notes: "",
    status: "SCHEDULED",
    selectedDate: "",
    endDate: "",
    recurrenceFreq: "none", // none | DAILY | WEEKLY | BIWEEKLY | MONTHLY
    recurrenceUntil: "",
    txAmount: "",
    txPaymentMethod: "",
    txInstallments: "1",
    txDueDate: "",
    txNotes: "",
  };
}

function formatForInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitialScrollTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const hour = Math.max(date.getHours() - 1, 7);
  return `${pad(hour)}:${pad(date.getMinutes())}:00`;
}

export default function Agenda() {
  const features    = useFeatures();
  const navigate    = useNavigate();
  const calendarRef = useRef(null);
  const idempotencyKeyRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState([...PROFESSIONALS]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [returnSuggestion, setReturnSuggestion] = useState(null); // { date, days, patientId, professional, procedureName }
  const [activeCategories, setActiveCategories] = useState(CATEGORY_FILTERS.map((c) => c.key));
  const [confirmTemplate, setConfirmTemplate] = useState(null);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  function f(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function searchPatients(q) {
    setPatientSearch(q);
    setForm((p) => ({ ...p, patientId: "" }));
    if (q.length < 1) { setPatientResults([]); setShowPatientDrop(false); return; }
    try {
      const res = await api.get("/patients", { params: { search: q, status: "active" } });
      setPatientResults(res.data.data ?? []);
      setShowPatientDrop(true);
    } catch { setPatientResults([]); }
  }

  function selectPatient(p) {
    setForm((prev) => ({ ...prev, patientId: p.id }));
    setPatientSearch(p.name);
    setShowPatientDrop(false);
  }

  function interpolate(body, vars) {
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  }

  function buildWhatsAppMessage(template, patientName, date) {
    if (!template?.body) return "";
    const d = new Date(date);
    return interpolate(template.body, {
      nome: patientName?.split(" ")[0] ?? "",
      data: d.toLocaleDateString("pt-BR"),
      hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
  }

  async function loadAppointments() {
    try {
      // Agendamentos (clicáveis/editáveis) + itens financeiros (visuais) do calendário unificado
      const [appts, calendar] = await Promise.all([
        api.get("/appointments"),
        api.get("/calendar").catch(() => ({ data: [] })),
      ]);

      const apptEvents = appts.data.map((a) => {
        const category = a.category || "consulta";
        const statusColor =
          (category !== "consulta" ? CATEGORY_COLORS[category] : null) ??
          STATUS_COLORS[a.status] ??
          STATUS_COLORS[a.status?.toUpperCase()] ??
          PROFESSIONAL_COLORS[a.professional] ??
          "#00704A";
        const base = {
          id: a.id,
          title: a.title || "Agendamento",
          allDay: a.isAllDay ?? false,
          backgroundColor: statusColor,
          borderColor: "transparent",
          extendedProps: {
            kind: "appointment",
            category,
            description: a.description ?? null,
            recurrenceRule: a.recurrenceRule ?? null,
            professional: a.professional,
            procedureType: a.procedureType,
            notes: a.notes,
            status: a.status,
            statusColor,
            professionalColor: PROFESSIONAL_COLORS[a.professional] ?? "#00704A",
            patientName: a.patient?.name ?? null,
            patientPhone: a.patient?.phone ?? null,
            patientId: a.patientId ?? null,
            transaction: a.transaction ?? null,
          },
        };
        // Evento recorrente: usa rrule + duração; senão, start/end normais.
        if (a.recurrenceRule) {
          const ms = new Date(a.endsAt) - new Date(a.startsAt);
          return {
            ...base,
            rrule: `DTSTART:${toRRuleDate(a.startsAt)}\nRRULE:${a.recurrenceRule}`,
            duration: { milliseconds: ms > 0 ? ms : 60 * 60 * 1000 },
            editable: false, // não arrastar/redimensionar ocorrências recorrentes
          };
        }
        return { ...base, start: a.startsAt, end: a.endsAt };
      });

      // Itens financeiros (a receber / a pagar) — apenas visuais no calendário.
      // Vêm do backend com horário fixo (09h); mostrados na grade horária.
      const finEvents = (calendar.data || [])
        .filter((e) => e.kind === "receivable" || e.kind === "payable")
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.isAllDay ?? false,
          backgroundColor: e.color,
          borderColor: "transparent",
          extendedProps: {
            kind: e.kind,
            category: e.category,
            amount: e.amount,
            status: e.status,
            transactionId: e.transactionId,
          },
        }));

      setAllEvents([...apptEvents, ...finEvents]);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPatients() {
    try {
      const res = await api.get("/patients");
      setPatients(res.data.data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadProcedures() {
    try {
      const res = await api.get("/procedures");
      setProcedures(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadAppointments();
    loadPatients();
    loadProcedures();
    if (features.whatsapp) {
      api.get("/automations/templates").then((res) => {
        const tpl = res.data.find((t) => t.type === "confirmation");
        if (tpl) setConfirmTemplate(tpl);
      }).catch(() => {});
    }
  }, [features.whatsapp]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // auto-preenche valor ao selecionar procedimento
  useEffect(() => {
    if (!editing && form.procedureType) {
      const proc = procedures.find((p) => p.name === form.procedureType);
      if (proc?.price) setForm((prev) => ({ ...prev, txAmount: String(proc.price) }));
    }
  }, [form.procedureType]);

  useEffect(() => {
    if (!editing && sendWhatsApp && form.patientId && form.selectedDate) {
      const patientName = patients.find((p) => p.id === form.patientId)?.name;
      setWhatsappMessage(buildWhatsAppMessage(confirmTemplate, patientName, form.selectedDate));
    }
  }, [form.patientId, form.selectedDate]);

  useEffect(() => {
    let list = allEvents.filter((e) =>
      activeCategories.includes(e.extendedProps?.category || "consulta")
    );
    if (features.multiProfessional) {
      list = list.filter(
        (e) =>
          e.extendedProps.kind !== "appointment" ||
          !e.extendedProps.professional ||
          selectedProfessionals.includes(e.extendedProps.professional)
      );
    }
    setEvents(list);
  }, [allEvents, selectedProfessionals, features.multiProfessional, activeCategories]);

  function toggleCategory(key) {
    setActiveCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleProfessional(name) {
    setSelectedProfessionals((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  }

  function gotoDate(date) {
    calendarRef.current?.getApi().gotoDate(date);
    calendarRef.current?.getApi().changeView("timeGridDay");
  }

  function openCreate(info) {
    setEditing(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    const date = info?.start || new Date();
    setForm({ ...emptyForm(), selectedDate: formatForInput(date) });
    setSendWhatsApp(confirmTemplate?.isActive ?? false);
    setWhatsappMessage("");
    setPatientSearch("");
    setPatientResults([]);
    setShowPatientDrop(false);
    setShowModal(true);
  }

  function openEdit(event) {
    // Itens financeiros (a receber/a pagar) são visuais; clicar leva ao Financeiro.
    const kind = event.extendedProps?.kind;
    if (kind === "receivable" || kind === "payable") {
      navigate("/financeiro");
      return;
    }
    setEditing(event);
    setForm({
      ...emptyForm(),
      title: event.title,
      category: event.extendedProps.category || "consulta",
      description: event.extendedProps.description || "",
      patientId: event.extendedProps.patientId || "",
      professional: event.extendedProps.professional || "",
      procedureType: event.extendedProps.procedureType || "",
      notes: event.extendedProps.notes || "",
      status: event.extendedProps.status || "SCHEDULED",
      selectedDate: formatForInput(event.start),
      endDate: formatForInput(event.end),
      recurrenceFreq: parseRecurrenceFreq(event.extendedProps.recurrenceRule),
    });
    const msg = buildWhatsAppMessage(confirmTemplate, event.extendedProps.patientName, event.start);
    setSendWhatsApp(false);
    setWhatsappMessage(msg);
    setShowModal(true);
  }

  async function handleSave() {
    if (savingAppointment) return;
    setSavingAppointment(true);
    try {
      const cat = form.category;
      const isSimple = SIMPLE_TYPES.includes(cat);          // lembrete | compromisso | bloqueio
      const hasEndField = cat === "compromisso" || cat === "bloqueio";
      const isRecorrente = isSimple; // lembrete, compromisso e bloqueio podem repetir

      const start = new Date(form.selectedDate);
      const explicitEnd = form.endDate ? new Date(form.endDate) : null;
      const endsAt = hasEndField && explicitEnd
        ? explicitEnd
        : new Date(start.getTime() + 60 * 60 * 1000);
      const recurrenceRule = isRecorrente
        ? buildRecurrenceRule(form.recurrenceFreq, form.recurrenceUntil)
        : null;

      const okMsg = {
        bloqueio: "Bloqueio", lembrete: "Lembrete", compromisso: "Compromisso",
      }[cat] || "Agendamento";

      if (editing) {
        await api.put(`/appointments/${editing.id}`, {
          title: form.title,
          description: isSimple ? form.description : undefined,
          startsAt: start,
          endsAt,
          professional: isSimple ? undefined : form.professional,
          procedureType: isSimple ? undefined : form.procedureType,
          notes: form.notes,
          status: isSimple ? undefined : form.status,
          category: cat,
          recurrenceRule: isRecorrente ? recurrenceRule : null,
        });
        toast.success(`${okMsg} atualizado`);
      } else {
        const title = cat === "bloqueio" && !form.title.trim() ? "Horário bloqueado" : form.title;
        const res = await api.post("/appointments", {
          title,
          description: isSimple ? form.description : undefined,
          startsAt: start,
          endsAt,
          patientId: isSimple ? undefined : form.patientId,
          professional: isSimple ? undefined : form.professional,
          color: isSimple ? CATEGORY_COLORS[cat] : PROFESSIONAL_COLORS[form.professional],
          notes: form.notes,
          procedureType: isSimple ? undefined : form.procedureType,
          status: isSimple ? undefined : form.status,
          category: cat,
          recurrenceRule,
          idempotencyKey: idempotencyKeyRef.current,
          txAmount: isSimple ? undefined : (form.txAmount || undefined),
          txPaymentMethod: isSimple ? undefined : (form.txPaymentMethod || undefined),
          txInstallments: !isSimple && Number(form.txInstallments) > 1 ? Number(form.txInstallments) : undefined,
          txDueDate: isSimple ? undefined : (form.txDueDate || undefined),
          txNotes: isSimple ? undefined : (form.txNotes || undefined),
        });
        // Renova a chave para o próximo agendamento
        idempotencyKeyRef.current = crypto.randomUUID();
        toast.success(`${okMsg} criado`);

        // Procedimento exige retorno → guarda sugestão pra abrir o modal depois
        if (res.data?.suggestedReturn) {
          setReturnSuggestion({
            ...res.data.suggestedReturn,
            patientId: form.patientId,
            professional: form.professional,
          });
        }
      }

      if (features.whatsapp && sendWhatsApp && whatsappMessage) {
        const phone = editing
          ? editing.extendedProps.patientPhone
          : patients.find((p) => p.id === form.patientId)?.phone;
        const patientName = editing
          ? editing.extendedProps.patientName
          : patients.find((p) => p.id === form.patientId)?.name;
        const patientId = editing
          ? editing.extendedProps.patientId
          : form.patientId;

        if (phone) {
          setSendingWhatsApp(true);
          await api.post("/automations/notify", {
            phone, message: whatsappMessage,
            patientId, patientName,
            type: editing ? "reminder" : "confirmation",
          }).catch(() => {});
          setSendingWhatsApp(false);
          toast.success("Notificação enviada via WhatsApp");
        }
      }

      setShowModal(false);
      loadAppointments();
    } catch (error) {
      toast.error(editing ? "Erro ao atualizar agendamento" : "Erro ao criar agendamento");
    } finally {
      setSavingAppointment(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/appointments/${editing.id}`);
      toast.success("Agendamento excluído");
      setShowModal(false);
      setEditing(null);
      loadAppointments();
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
    }
  }

  // ── Retorno de procedimento ──
  async function createReturn(category, dateOverride) {
    if (!returnSuggestion) return;
    const start = new Date(dateOverride || returnSuggestion.date);
    const isReminder = category === "lembrete";
    const patientName = patients.find((p) => p.id === returnSuggestion.patientId)?.name || "";
    try {
      await api.post("/appointments", {
        title: isReminder
          ? `Lembrete de retorno — ${patientName}`
          : `Retorno — ${returnSuggestion.procedureName}`,
        startsAt: start,
        endsAt: new Date(start.getTime() + 60 * 60 * 1000),
        patientId: returnSuggestion.patientId,
        professional: returnSuggestion.professional,
        category,
        isAllDay: isReminder,
        color: PROFESSIONAL_COLORS[returnSuggestion.professional],
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success(isReminder ? "Lembrete de retorno criado" : "Retorno agendado");
      setReturnSuggestion(null);
      loadAppointments();
    } catch {
      toast.error("Erro ao criar retorno");
    }
  }

  async function handleEventDrop(info) {
    try {
      await api.put(`/appointments/${info.event.id}`, {
        startsAt: info.event.start,
        endsAt: info.event.end,
      });
      loadAppointments();
    } catch (error) {
      toast.error("Erro ao mover agendamento");
    }
  }

  async function handleEventResize(info) {
    try {
      await api.put(`/appointments/${info.event.id}`, {
        startsAt: info.event.start,
        endsAt: info.event.end,
      });
      loadAppointments();
    } catch (error) {
      toast.error("Erro ao alterar duração");
    }
  }

  const todayCount = allEvents.filter((e) => {
    const d = new Date(e.start);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  // Tipos "simples" (lembrete/compromisso/bloqueio): só título, descrição e datas.
  const isSimple = SIMPLE_TYPES.includes(form.category);
  const hasEndField = form.category === "compromisso" || form.category === "bloqueio";
  const isRecorrente = isSimple; // lembrete, compromisso e bloqueio podem repetir

  return (
    <MainLayout>
      <div className="flex gap-5 h-[calc(100vh-90px)]">
        {/* SIDEBAR */}
        <CalendarSidebar
          selectedProfessionals={features.multiProfessional ? selectedProfessionals : null}
          toggleProfessional={features.multiProfessional ? toggleProfessional : null}
          allEvents={allEvents}
          gotoDate={gotoDate}
        />

        {/* CONTEÚDO */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* HEADER */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold text-verde">Agenda</h1>
                <span className="bg-creme-100 text-verde border border-ambar text-xs font-semibold px-2.5 py-1 rounded-full">
                  Agora {formatTime(now)}
                </span>
                {todayCount > 0 && (
                  <span className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {todayCount} hoje
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">Gerencie os agendamentos da clínica</p>
            </div>
            <button
              onClick={() => openCreate()}
              className="bg-verde hover:bg-verde-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
            >
              <Plus size={16} /> Novo agendamento
            </button>
          </div>

          {/* FILTROS POR CATEGORIA */}
          <div className="flex flex-wrap gap-2 mb-3">
            {CATEGORY_FILTERS.map((c) => {
              const on = activeCategories.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleCategory(c.key)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                    on ? "text-white border-transparent" : "text-gray-400 border-creme-200 bg-white"
                  }`}
                  style={on ? { backgroundColor: CATEGORY_COLORS[c.key] } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: on ? "#fff" : CATEGORY_COLORS[c.key] }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* CALENDÁRIO */}
          <Card className="bg-creme-50! p-4 flex-1 overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
              initialView="timeGridWeek"
              locale={ptBrLocale}
              selectable
              selectMirror
              editable
              select={openCreate}
              eventClick={(info) => openEdit(info.event)}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
              events={events}
              height="100%"
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              nowIndicator
              scrollTime={getInitialScrollTime()}
              scrollTimeReset={false}
              allDaySlot={false}
              eventDidMount={(info) => {
                const color = info.event.extendedProps.statusColor;
                if (color) {
                  info.el.style.backgroundColor = color;
                  info.el.style.borderColor = "transparent";
                }
              }}
              eventContent={(info) => {
                const isMonth = info.view.type === "dayGridMonth";
                const { patientName, procedureType, professional, professionalColor } = info.event.extendedProps;
                if (isMonth) {
                  return (
                    <div className="px-1.5 py-0.5 w-full overflow-hidden">
                      <p className="text-[11px] font-semibold truncate text-white leading-tight">
                        {info.event.title}
                      </p>
                      {patientName && (
                        <p className="text-[9px] truncate text-white/70 leading-tight">
                          {patientName}
                        </p>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="px-2 py-1 text-xs w-full h-full overflow-hidden flex flex-col gap-0.5">
                    <p className="font-semibold truncate leading-tight text-white">
                      {info.event.title}
                    </p>
                    {patientName && (
                      <p className="truncate leading-tight text-white/80 text-[10px]">
                        {patientName}
                      </p>
                    )}
                    {procedureType && (
                      <p className="truncate leading-tight text-white/60 text-[10px]">
                        {procedureType}
                      </p>
                    )}
                    {professional && (
                      <div className="flex items-center gap-1 mt-auto">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: professionalColor }}
                        />
                        <p className="truncate text-white/70 text-[10px]">
                          {professional}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </Card>
        </div>
      </div>

      {/* MODAL DE RETORNO */}
      {returnSuggestion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-verde mb-1">Agendar retorno?</h3>
            <p className="text-sm text-gray-500 mb-4">
              O procedimento <strong>{returnSuggestion.procedureName}</strong> requer retorno
              em <strong>{returnSuggestion.days} dias</strong>.
            </p>
            <label className="text-xs font-medium text-gray-500">Data sugerida (editável)</label>
            <input
              type="datetime-local"
              defaultValue={formatForInput(returnSuggestion.date)}
              onChange={(e) => setReturnSuggestion((p) => ({ ...p, date: new Date(e.target.value).toISOString() }))}
              className="w-full border border-creme-200 rounded-xl px-3 py-2 text-sm mt-1 mb-5 focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
            <div className="flex flex-col gap-2">
              <button onClick={() => createReturn("retorno")}
                className="bg-verde hover:bg-verde-900 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                Marcar retorno nesta data
              </button>
              <button onClick={() => createReturn("lembrete")}
                className="border border-ambar text-[#7a5c1e] bg-ambar/10 text-sm font-medium py-2.5 rounded-xl transition hover:bg-ambar/20">
                Deixar como lembrete
              </button>
              <button onClick={() => setReturnSuggestion(null)}
                className="text-gray-400 text-sm py-2 rounded-xl hover:bg-gray-50 transition">
                Desconsiderar retorno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-creme-100 rounded-lg flex items-center justify-center">
                  <Calendar size={15} className="text-verde" />
                </div>
                <h2 className="text-lg font-bold text-verde">
                  {editing ? "Editar" : "Novo"}{" "}
                  {isSimple
                    ? { lembrete: "lembrete", compromisso: "compromisso", bloqueio: "bloqueio" }[form.category]
                    : "agendamento"}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* TIPO — escolhido antes de preencher o resto */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Tipo</label>
                <div className="flex flex-wrap gap-1.5">
                  {APPOINTMENT_TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category: key }))}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition border flex items-center gap-1.5 ${
                        form.category === key
                          ? "border-verde bg-verde text-white"
                          : "border-ambar text-verde hover:bg-creme-100"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[key] }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                  {form.category === "bloqueio" ? "Motivo" : "Título"}
                </label>
                <input
                  value={form.title}
                  onChange={f("title")}
                  placeholder={form.category === "bloqueio" ? "Ex: Almoço, folga, congresso…" : "Ex: Toxina botulínica"}
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>

              {/* Descrição — tipos simples */}
              {isSimple && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Descrição</label>
                  <textarea
                    value={form.description}
                    onChange={f("description")}
                    rows={2}
                    placeholder="Detalhes…"
                    className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-verde/20"
                  />
                </div>
              )}

              {!editing && !isSimple && (
                <div className="relative">
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Paciente</label>
                  <input
                    value={patientSearch}
                    onChange={(e) => searchPatients(e.target.value)}
                    onFocus={() => patientSearch && setShowPatientDrop(true)}
                    onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
                    placeholder="Buscar por nome ou telefone…"
                    className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                  />
                  {form.patientId && (
                    <span className="absolute right-3 top-9 text-[10px] text-green-600 font-medium inline-flex items-center gap-1"><Check size={10} /> selecionado</span>
                  )}
                  {showPatientDrop && patientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-ambar rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selectPatient(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-creme-100 transition border-b border-[#F0E8DC] last:border-0"
                        >
                          <p className="font-medium text-verde">{p.name}</p>
                          {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showPatientDrop && patientResults.length === 0 && patientSearch.length > 1 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-ambar rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                      Nenhum paciente encontrado
                    </div>
                  )}
                </div>
              )}
              {editing && editing.extendedProps.patientName && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Paciente</label>
                  <div className="w-full border border-creme-200 rounded-xl p-3 text-sm bg-creme-50 text-verde font-medium">
                    {editing.extendedProps.patientName}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                  {hasEndField ? "Início" : "Data e hora"}
                </label>
                <input
                  type="datetime-local"
                  value={form.selectedDate}
                  onChange={f("selectedDate")}
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>

              {hasEndField && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Fim</label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={f("endDate")}
                    className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                  />
                  {form.category === "bloqueio" && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      O período fica marcado como indisponível na agenda.
                    </p>
                  )}
                </div>
              )}

              {/* Recorrência — só compromisso */}
              {isRecorrente && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Repetir</label>
                  <div className="flex flex-wrap gap-1.5">
                    {RECURRENCE_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, recurrenceFreq: key }))}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${
                          form.recurrenceFreq === key
                            ? "border-verde bg-verde text-white"
                            : "border-ambar text-verde hover:bg-creme-100"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.recurrenceFreq !== "none" && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-500 block mb-1.5">Repetir até (opcional)</label>
                      <input
                        type="date"
                        value={form.recurrenceUntil}
                        onChange={f("recurrenceUntil")}
                        className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Sem data limite, repete indefinidamente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!isSimple && features.multiProfessional && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Profissional</label>
                  <div className="flex gap-2">
                    {PROFESSIONALS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, professional: name }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition border ${
                          form.professional === name
                            ? "border-verde bg-verde text-white"
                            : "border-ambar text-verde hover:bg-creme-100"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isSimple && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                <select
                  value={form.procedureType}
                  onChange={f("procedureType")}
                  className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                >
                  <option value="">Selecione o procedimento</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.duration ? ` (${p.duration} min)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {!isSimple && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, status: value }))}
                      className={`py-2 rounded-xl text-xs font-medium transition border ${
                        form.status === value
                          ? "border-verde bg-verde text-white"
                          : "border-ambar text-verde hover:bg-creme-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {!isSimple && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Informações adicionais…"
                  rows={3}
                  className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-verde/20"
                />
              </div>
              )}

              {/* INFORMAÇÕES FINANCEIRAS (só na criação) */}
              {!editing && !isSimple && (
                <div className="border-t border-creme-200 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign size={12} /> Financeiro
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1.5">
                        Valor (R$)
                        {form.procedureType && procedures.find(p => p.name === form.procedureType)?.price && (
                          <span className="ml-1 text-[10px] text-emerald-600 font-normal">preenchido automaticamente</span>
                        )}
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.txAmount}
                        onChange={f("txAmount")}
                        placeholder="0,00"
                        className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1.5">Forma de pagamento</label>
                      <select
                        value={form.txPaymentMethod}
                        onChange={f("txPaymentMethod")}
                        className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                      >
                        <option value="">Selecione</option>
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1.5">Parcelas</label>
                      <input
                        type="number" min="1" max="60"
                        value={form.txInstallments}
                        onChange={f("txInstallments")}
                        className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1.5">
                        {Number(form.txInstallments) > 1 ? "Vencimento 1ª parcela" : "Vencimento"}
                      </label>
                      <input
                        type="date"
                        value={form.txDueDate}
                        onChange={f("txDueDate")}
                        className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                      />
                    </div>
                  </div>

                  {Number(form.txInstallments) > 1 && form.txAmount && (
                    <p className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                      {form.txInstallments}x de{" "}
                      {(Number(form.txAmount) / Number(form.txInstallments)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {" "}— vencimento mensal a partir da data informada
                    </p>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Observação financeira</label>
                    <input
                      value={form.txNotes}
                      onChange={f("txNotes")}
                      placeholder="Ex: sinal pago, parcelar no retorno…"
                      className="w-full border border-ambar rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-verde/20"
                    />
                  </div>
                </div>
              )}

              {/* SITUAÇÃO FINANCEIRA (só na edição) */}
              {editing && !isSimple && (() => {
                const tx = editing.extendedProps.transaction;
                const STATUS_PILL = {
                  pendente:   "bg-amber-100 text-amber-700",
                  confirmado: "bg-emerald-100 text-emerald-700",
                  cancelado:  "bg-gray-100 text-gray-500",
                };
                const fmtVal = (v) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                return (
                  <div className="border-t border-creme-200 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <DollarSign size={12} /> Situação financeira
                    </p>
                    {tx ? (
                      <div className="bg-creme-50 border border-creme-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tx.type === "receita"
                            ? <TrendingUp size={14} className="text-emerald-600" />
                            : <TrendingDown size={14} className="text-red-500" />}
                          <div>
                            <p className="text-sm font-semibold text-verde">{fmtVal(tx.amount)}</p>
                            {tx.paymentMethod && <p className="text-xs text-gray-400">{tx.paymentMethod}</p>}
                          </div>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[tx.status] ?? STATUS_PILL.cancelado}`}>
                          {tx.status === "pendente" ? "Pendente" : tx.status === "confirmado" ? "Confirmado" : "Cancelado"}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 bg-creme-50 border border-creme-200 rounded-xl px-4 py-3">
                        Nenhuma transação vinculada. Ao concluir o agendamento, uma transação pendente será criada automaticamente.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* WHATSAPP */}
              {features.whatsapp && !isSimple && (
              <div className="border-t border-creme-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const next = !sendWhatsApp;
                    setSendWhatsApp(next);
                    if (next && !whatsappMessage) {
                      const patientName = editing
                        ? editing.extendedProps.patientName
                        : patients.find((p) => p.id === form.patientId)?.name;
                      const date = form.selectedDate || editing?.start;
                      setWhatsappMessage(buildWhatsAppMessage(confirmTemplate, patientName, date));
                    }
                  }}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-verde">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${sendWhatsApp ? "bg-green-100" : "bg-creme-100"}`}>
                      <MessageSquare size={15} className={sendWhatsApp ? "text-green-600" : "text-verde"} />
                    </div>
                    Enviar notificação via WhatsApp
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${sendWhatsApp ? "bg-green-500" : "bg-gray-200"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sendWhatsApp ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                </button>

                {sendWhatsApp && (
                  <div className="mt-3 space-y-2">
                    {!editing && !form.patientId ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        Selecione o paciente para pré-preencher a mensagem.
                      </p>
                    ) : null}
                    <div className="relative">
                      <textarea
                        value={whatsappMessage}
                        onChange={(e) => setWhatsappMessage(e.target.value)}
                        rows={4}
                        placeholder="Mensagem personalizada…"
                        className="w-full border border-ambar rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20 bg-green-50/30"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const patientName = editing
                            ? editing.extendedProps.patientName
                            : patients.find((p) => p.id === form.patientId)?.name;
                          const date = form.selectedDate || editing?.start;
                          setWhatsappMessage(buildWhatsAppMessage(confirmTemplate, patientName, date));
                        }}
                        className="absolute bottom-2 right-2 text-[10px] text-gray-400 hover:text-verde transition"
                      >
                        ↺ regenerar
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {editing ? "Paciente:" : "Para:"} <span className="font-medium text-verde">
                        {editing
                          ? (editing.extendedProps.patientName || "—")
                          : (patients.find((p) => p.id === form.patientId)?.name || "—")}
                      </span>
                      {" · "}
                      {editing
                        ? (editing.extendedProps.patientPhone || "sem telefone")
                        : (patients.find((p) => p.id === form.patientId)?.phone || "sem telefone")}
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div>
                {editing && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-600 text-sm transition"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="border border-ambar px-4 py-2 rounded-xl text-sm hover:bg-creme-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={savingAppointment || sendingWhatsApp}
                  className="bg-verde hover:bg-verde-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60"
                >
                  {sendingWhatsApp ? "Enviando…" : savingAppointment ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
