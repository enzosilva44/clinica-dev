import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { Plus, X, Trash2, Calendar, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout";
import CalendarSidebar from "../components/calendar/CalendarSidebar";
import "../components/calendar/calendar.css";
import api from "../services/api";

const PROFESSIONALS = ["Dra Ana", "Dra Julia", "Dra Camila"];
const PROFESSIONAL_COLORS = {
  "Dra Ana":    "#314D3E",
  "Dra Julia":  "#7C9A92",
  "Dra Camila": "#C4A882",
};
const STATUS_COLORS = {
  SCHEDULED:   "#C4895A",
  CONFIRMED:   "#4A8EC2",
  IN_PROGRESS: "#D4A017",
  FINISHED:    "#3A9B6F",
  CANCELED:    "#B05248",
};
const STATUS_OPTIONS = [
  { value: "SCHEDULED",   label: "Agendado" },
  { value: "CONFIRMED",   label: "Confirmado" },
  { value: "IN_PROGRESS", label: "Em atendimento" },
  { value: "FINISHED",    label: "Concluído" },
  { value: "CANCELED",    label: "Cancelado" },
];

function emptyForm() {
  return {
    title: "",
    patientId: "",
    professional: "Dra Ana",
    procedureType: "",
    notes: "",
    status: "SCHEDULED",
    selectedDate: "",
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
  const calendarRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState([...PROFESSIONALS]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmTemplate, setConfirmTemplate] = useState(null);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  function f(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
      const res = await api.get("/appointments");
      setAllEvents(
        res.data.map((a) => {
          const statusColor =
            STATUS_COLORS[a.status] ??
            STATUS_COLORS[a.status?.toUpperCase()] ??
            PROFESSIONAL_COLORS[a.professional] ??
            "#314D3E";
          return {
            id: a.id,
            title: a.title || "Agendamento",
            start: a.startsAt,
            end: a.endsAt,
            backgroundColor: statusColor,
            borderColor: "transparent",
            extendedProps: {
              professional: a.professional,
              procedureType: a.procedureType,
              notes: a.notes,
              status: a.status,
              statusColor,
              professionalColor: PROFESSIONAL_COLORS[a.professional] ?? "#314D3E",
              patientName: a.patient?.name ?? null,
              patientPhone: a.patient?.phone ?? null,
              patientId: a.patientId ?? null,
            },
          };
        })
      );
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
    api.get("/automations/templates").then((res) => {
      const tpl = res.data.find((t) => t.type === "confirmation");
      if (tpl) setConfirmTemplate(tpl);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setEvents(
      allEvents.filter(
        (e) => !e.extendedProps.professional || selectedProfessionals.includes(e.extendedProps.professional)
      )
    );
  }, [allEvents, selectedProfessionals]);

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
    const date = info?.start || new Date();
    setForm({ ...emptyForm(), selectedDate: formatForInput(date) });
    setSendWhatsApp(confirmTemplate?.isActive ?? false);
    setWhatsappMessage("");
    setShowModal(true);
  }

  function openEdit(event) {
    setEditing(event);
    setForm({
      title: event.title,
      patientId: "",
      professional: event.extendedProps.professional || "",
      procedureType: event.extendedProps.procedureType || "",
      notes: event.extendedProps.notes || "",
      status: event.extendedProps.status || "SCHEDULED",
      selectedDate: formatForInput(event.start),
    });
    const msg = buildWhatsAppMessage(confirmTemplate, event.extendedProps.patientName, event.start);
    setSendWhatsApp(false);
    setWhatsappMessage(msg);
    setShowModal(true);
  }

  async function handleSave() {
    try {
      let savedAppointment;
      if (editing) {
        savedAppointment = await api.put(`/appointments/${editing.id}`, {
          title: form.title,
          startsAt: form.selectedDate,
          endsAt: form.selectedDate,
          professional: form.professional,
          procedureType: form.procedureType,
          notes: form.notes,
          status: form.status,
        });
        toast.success("Agendamento atualizado");
      } else {
        const start = new Date(form.selectedDate);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        savedAppointment = await api.post("/appointments", {
          title: form.title,
          startsAt: start,
          endsAt: end,
          patientId: form.patientId,
          professional: form.professional,
          color: PROFESSIONAL_COLORS[form.professional],
          notes: form.notes,
          procedureType: form.procedureType,
          status: form.status,
        });
        toast.success("Agendamento criado");
      }

      if (sendWhatsApp && whatsappMessage) {
        const appt = savedAppointment.data;
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

  return (
    <MainLayout>
      <div className="flex gap-5 h-[calc(100vh-90px)]">
        {/* SIDEBAR */}
        <CalendarSidebar
          selectedProfessionals={selectedProfessionals}
          toggleProfessional={toggleProfessional}
          allEvents={allEvents}
          gotoDate={gotoDate}
        />

        {/* CONTEÚDO */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* HEADER */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold text-[#314D3E]">Agenda</h1>
                <span className="bg-[#EFE7DA] text-[#314D3E] border border-[#D6C1A3] text-xs font-semibold px-2.5 py-1 rounded-full">
                  Agora {formatTime(now)}
                </span>
                {todayCount > 0 && (
                  <span className="bg-[#314D3E] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {todayCount} hoje
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">Gerencie os agendamentos da clínica</p>
            </div>
            <button
              onClick={() => openCreate()}
              className="bg-[#314D3E] hover:bg-[#465634] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition text-sm font-medium"
            >
              <Plus size={16} /> Novo agendamento
            </button>
          </div>

          {/* CALENDÁRIO */}
          <div className="bg-[#FAF7F2] border border-[#E5D8C5] rounded-2xl p-4 shadow-sm flex-1 overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
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
                if (isMonth) {
                  return (
                    <div className="px-1.5 flex items-center gap-1 w-full overflow-hidden">
                      <span className="text-[11px] font-semibold truncate text-white leading-5">
                        {info.event.title}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="px-2 py-1 text-xs w-full h-full overflow-hidden flex flex-col gap-0.5">
                    <p className="font-semibold truncate leading-tight text-white">
                      {info.event.title}
                    </p>
                    {info.event.extendedProps.procedureType && (
                      <p className="truncate leading-tight text-white/75 text-[10px]">
                        {info.event.extendedProps.procedureType}
                      </p>
                    )}
                    {info.event.extendedProps.professional && (
                      <div className="flex items-center gap-1 mt-auto">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: info.event.extendedProps.professionalColor }}
                        />
                        <p className="truncate text-white/70 text-[10px]">
                          {info.event.extendedProps.professional}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#EFE7DA] rounded-lg flex items-center justify-center">
                  <Calendar size={15} className="text-[#314D3E]" />
                </div>
                <h2 className="text-lg font-bold text-[#314D3E]">
                  {editing ? "Editar agendamento" : "Novo agendamento"}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Título</label>
                <input
                  value={form.title}
                  onChange={f("title")}
                  placeholder="Ex: Toxina botulínica"
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                />
              </div>

              {!editing && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">Paciente</label>
                  <select
                    value={form.patientId}
                    onChange={f("patientId")}
                    className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                  >
                    <option value="">Selecione o paciente</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Data e hora</label>
                <input
                  type="datetime-local"
                  value={form.selectedDate}
                  onChange={f("selectedDate")}
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                />
              </div>

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
                          ? "border-[#314D3E] bg-[#314D3E] text-white"
                          : "border-[#D6C1A3] text-[#314D3E] hover:bg-[#EFE7DA]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Procedimento</label>
                <select
                  value={form.procedureType}
                  onChange={f("procedureType")}
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                >
                  <option value="">Selecione o procedimento</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}{p.duration ? ` (${p.duration} min)` : ""}
                    </option>
                  ))}
                </select>
              </div>

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
                          ? "border-[#314D3E] bg-[#314D3E] text-white"
                          : "border-[#D6C1A3] text-[#314D3E] hover:bg-[#EFE7DA]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Informações adicionais…"
                  rows={3}
                  className="w-full border border-[#D6C1A3] rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#314D3E]/20"
                />
              </div>
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
                  className="border border-[#D6C1A3] px-4 py-2 rounded-xl text-sm hover:bg-[#EFE7DA] transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="bg-[#314D3E] hover:bg-[#465634] text-white px-5 py-2 rounded-xl text-sm font-medium transition"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
