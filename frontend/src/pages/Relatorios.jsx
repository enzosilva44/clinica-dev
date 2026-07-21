import { useEffect, useRef, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Users, CalendarCheck, DollarSign, BarChart2, Download, Sparkles, Send, Bot, User } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { Card } from "../components/ui";
import api from "../services/api";
import toast from "react-hot-toast";
import { mensagemDeErro } from "../lib/tomDeVoz";

const PRESETS = [
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 3 meses", days: 90 },
  { label: "Últimos 6 meses", days: 180 },
  { label: "Este ano", days: 365 },
];

const STATUS_LABELS = {
  COMPLETED: "Realizados",
  CONFIRMED: "Confirmados",
  SCHEDULED: "Agendados",
  CANCELED: "Cancelados",
};

const STATUS_COLORS = {
  COMPLETED: "#3A9B6F",
  CONFIRMED: "#4A8EC2",
  SCHEDULED: "#C4895A",
  CANCELED: "#B05248",
};

const PAYMENT_COLORS = ["#00704A", "#4A8EC2", "#C4895A", "#3A9B6F", "#9B6BB5", "#6F7F73"];

function fmt(value) {
  return value?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0,00";
}

function fmtShort(value) {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/");
}

const CustomTooltipCurrency = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-creme-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-verde mb-1.5">{monthLabel(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const CustomTooltipCount = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-creme-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-verde mb-1">{monthLabel(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function KpiCard({ icon: Icon, label, value, sub, subUp, color = "#00704A", loading }) {
  return (
    <Card className="bg-white! p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {sub != null && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${subUp ? "text-sucesso" : "text-erro"}`}>
            {subUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {sub}
          </span>
        )}
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-24 bg-creme-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-black text-verde-900 leading-none font-mono">{value}</p>
        )}
        <p className="text-xs text-gray-400 mt-1.5 font-medium">{label}</p>
      </div>
    </Card>
  );
}

export default function Relatorios() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState(1); // index in PRESETS (default: 3 meses)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customMode, setCustomMode] = useState(false);

  const load = useCallback(async (fromDate, toDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await api.get(`/reports?${params}`);
      setData(res.data);
    } catch (err) {
      toast.error(mensagemDeErro(err, "carregar os relatórios"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customMode) return;
    const days = PRESETS[preset].days;
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days + 1);
    load(fromDate.toISOString().split("T")[0], toDate.toISOString().split("T")[0]);
  }, [preset, customMode, load]);

  function applyCustom() {
    if (!from || !to) return toast.error("Selecione as datas");
    if (from > to) return toast.error("Data inicial deve ser antes da final");
    load(from, to);
  }

  const f = data?.financial;
  const a = data?.appointments;
  const p = data?.patients;
  const pr = data?.procedures;

  const statusPieData = a
    ? Object.entries(a.byStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({ name: STATUS_LABELS[key] ?? key, value, key }))
    : [];

  const revenueChart = (f?.revenueChartData ?? []).map((d) => ({
    ...d,
    month: d.month,
  }));

  const apptChart = (a?.byMonth ?? []).map((d) => ({ ...d, month: d.month }));
  const patientsChart = (p?.byMonth ?? []).map((d) => ({ ...d, month: d.month }));

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif font-light text-3xl text-verde-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Visão analítica da sua clínica</p>
        </div>
        <button
          onClick={() => toast("Exportação em breve")}
          className="flex items-center gap-2 border border-ambar hover:bg-creme-100 px-4 py-2.5 rounded-xl text-sm font-medium text-verde transition"
        >
          <Download size={15} /> Exportar PDF
        </button>
      </div>

      {/* Period selector */}
      <Card className="bg-white! p-4 mb-7 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">Período</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPreset(i); setCustomMode(false); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                !customMode && preset === i
                  ? "bg-verde text-white border-verde"
                  : "border-ambar text-verde hover:bg-creme-100"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCustomMode(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
              customMode
                ? "bg-verde text-white border-verde"
                : "border-ambar text-verde hover:bg-creme-100"
            }`}
          >
            Personalizado
          </button>
        </div>
        {customMode && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-ambar rounded-xl px-3 py-1.5 text-xs text-verde font-mono focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
            <span className="text-gray-400 text-xs">até</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-ambar rounded-xl px-3 py-1.5 text-xs text-verde font-mono focus:outline-none focus:ring-2 focus:ring-verde/20"
            />
            <button
              onClick={applyCustom}
              className="bg-verde text-white px-4 py-1.5 rounded-xl text-xs font-semibold hover:bg-verde-900 transition"
            >
              Aplicar
            </button>
          </div>
        )}
      </Card>

      {/* AI Chat */}
      <div className="mb-7">
        <AiChat />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiCard
          icon={DollarSign}
          label="Receita no período"
          value={fmt(f?.totalRevenue)}
          color="#3A9B6F"
          loading={loading}
        />
        <KpiCard
          icon={TrendingDown}
          label="Despesas no período"
          value={fmt(f?.totalExpenses)}
          color="#B05248"
          loading={loading}
        />
        <KpiCard
          icon={CalendarCheck}
          label="Agendamentos"
          value={a?.total ?? "—"}
          sub={a ? `${a.completionRate}% realizados` : null}
          subUp
          color="#4A8EC2"
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Novos pacientes"
          value={p?.newInPeriod ?? "—"}
          sub={p ? `${p.totalActive} ativos total` : null}
          subUp
          color="#C4895A"
          loading={loading}
        />
      </div>

      {/* ROW 1: Receita x Despesas + Status agendamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Receita x Despesas */}
        <Card className="lg:col-span-2 bg-white! p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-verde-900">Receita × Despesas</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Lucro líquido: <span className="font-semibold text-verde font-mono">{fmt(f?.netProfit)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-sucesso" />Receita
              </span>
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B05248]" />Despesas
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-48 bg-creme-50 rounded-xl animate-pulse" />
          ) : revenueChart.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3A9B6F" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3A9B6F" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B05248" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#B05248" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE0" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CustomTooltipCurrency />} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="#3A9B6F" strokeWidth={2} fill="url(#gradReceita)" dot={false} activeDot={{ r: 4, fill: "#3A9B6F" }} />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#B05248" strokeWidth={2} fill="url(#gradDespesas)" dot={false} activeDot={{ r: 4, fill: "#B05248" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Status agendamentos */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-1">Agendamentos por status</h3>
          <p className="text-xs text-gray-400 mb-4 font-mono">
            {a?.cancellationRate ?? 0}% taxa de cancelamento
          </p>
          {loading ? (
            <div className="h-48 bg-creme-50 rounded-xl animate-pulse" />
          ) : statusPieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#C4895A"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #E5D8C5" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {statusPieData.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.key] }} />
                      <span className="text-xs text-gray-600">{entry.name}</span>
                    </div>
                    <span className="text-xs font-bold text-verde font-mono">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ROW 2: Formas de pagamento + Top procedimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Formas de pagamento */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-5">Receita por forma de pagamento</h3>
          {loading ? (
            <div className="h-48 bg-creme-50 rounded-xl animate-pulse" />
          ) : !f?.byPaymentMethod?.length ? (
            <EmptyChart />
          ) : (
            <div className="space-y-3">
              {f.byPaymentMethod.map((item, i) => {
                const pct = f.totalRevenue > 0 ? (item.total / f.totalRevenue) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 capitalize">{item.method}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-bold text-verde font-mono">{fmt(item.total)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-creme-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-creme-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Ticket médio</span>
                <span className="text-sm font-black text-verde font-mono">{fmt(f.avgTicket)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Top procedimentos */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-5">Procedimentos mais realizados</h3>
          {loading ? (
            <div className="h-48 bg-creme-50 rounded-xl animate-pulse" />
          ) : !pr?.top?.length ? (
            <EmptyChart label="Nenhum procedimento registrado no período" />
          ) : (
            <div className="space-y-3">
              {pr.top.map((item, i) => {
                const max = pr.top[0].count;
                const pct = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 truncate max-w-[65%]">{item.name}</span>
                      <span className="text-xs font-bold text-verde font-mono shrink-0">{item.count}x</span>
                    </div>
                    <div className="h-2 bg-creme-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: i === 0 ? "#00704A" : i === 1 ? "#4A8EC2" : "#6F7F73",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ROW 3: Agendamentos por mês + Novos pacientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Agendamentos por mês */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-1">Atendimentos por mês</h3>
          <p className="text-xs text-gray-400 mb-4">Agendamentos realizados (excl. cancelados)</p>
          {loading ? (
            <div className="h-44 bg-creme-50 rounded-xl animate-pulse" />
          ) : apptChart.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={apptChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE0" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltipCount />} />
                <Bar dataKey="count" name="Atendimentos" fill="#00704A" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Novos pacientes */}
        <Card className="bg-white! p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-verde-900">Novos pacientes por mês</h3>
              <p className="text-xs text-gray-400 mt-0.5">Total ativo: <span className="font-mono">{p?.totalActive ?? "—"}</span> pacientes</p>
            </div>
            {p?.totalActiveClub != null && p.totalActiveClub > 0 && (
              <span className="text-xs bg-creme-100 text-verde font-semibold px-2.5 py-1 rounded-full shrink-0 font-mono">
                {p.totalActiveClub} no clube
              </span>
            )}
          </div>
          <div className="mb-4" />
          {loading ? (
            <div className="h-44 bg-creme-50 rounded-xl animate-pulse" />
          ) : patientsChart.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={patientsChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE0" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltipCount />} />
                <Bar dataKey="count" name="Novos pacientes" fill="#C4895A" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ROW 4: Dias da semana + Profissionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Dias da semana */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-5">Atendimentos por dia da semana</h3>
          {loading ? (
            <div className="h-36 bg-creme-50 rounded-xl animate-pulse" />
          ) : (
            (() => {
              const wd = a?.byWeekday ?? [];
              const max = Math.max(...wd.map((d) => d.count), 1);
              return (
                <div className="flex items-end gap-2 h-28">
                  {wd.map((d, i) => {
                    const pct = max > 0 ? (d.count / max) * 100 : 0;
                    const isTop = d.count > 0 && d.count === max;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-gray-400 font-mono">{d.count || ""}</span>
                        <div
                          className="w-full rounded-t-lg transition-all duration-700"
                          style={{
                            height: `${Math.max(pct, d.count > 0 ? 10 : 4)}%`,
                            minHeight: "4px",
                            backgroundColor: isTop ? "#00704A" : d.count > 0 ? "#6F7F73" : "#EFE7DA",
                          }}
                        />
                        <span className="text-[10px] font-medium text-gray-400">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </Card>

        {/* Top profissionais */}
        <Card className="bg-white! p-5">
          <h3 className="text-sm font-bold text-verde-900 mb-5">Atendimentos por profissional</h3>
          {loading ? (
            <div className="h-36 bg-creme-50 rounded-xl animate-pulse" />
          ) : !a?.byProfessional?.length ? (
            <EmptyChart label="Nenhum profissional identificado" />
          ) : (
            <div className="space-y-3">
              {a.byProfessional.map((item, i) => {
                const max = a.byProfessional[0].count;
                const pct = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 truncate max-w-[70%]">{item.name}</span>
                      <span className="text-xs font-bold text-verde font-mono">{item.count} atend.</span>
                    </div>
                    <div className="h-2 bg-creme-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: i === 0 ? "#00704A" : "#6F7F73",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}

function EmptyChart({ label = "Sem dados no período selecionado" }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <BarChart2 size={28} className="text-ambar" />
      <p className="text-xs text-gray-400 text-center">{label}</p>
    </div>
  );
}

const SUGGESTIONS = [
  "Quantos pacientes ativos eu tenho?",
  "Quais pacientes não voltam há mais de 60 dias?",
  "Qual meu procedimento mais realizado?",
  "Qual foi minha receita este mês?",
  "Liste pacientes com mais de 40 anos",
  "Quantos agendamentos foram cancelados?",
];

function AiChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await api.post("/ai/chat-reports", {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      toast.error(mensagemDeErro(err, "consultar a IA"));
      setMessages(newMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-white! p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-creme-100 bg-[#FAF8F5]">
        <div className="w-8 h-8 rounded-xl bg-verde flex items-center justify-center">
          <Sparkles size={14} className="text-ambar" />
        </div>
        <div>
          <p className="text-sm font-bold text-verde-900">Chat com dados</p>
          <p className="text-xs text-gray-400">Pergunte sobre seus pacientes e dados da clínica</p>
        </div>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-3 bg-[#FAFAF8]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <p className="text-xs text-gray-400 font-medium">Sugestões de perguntas</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-ambar text-verde hover:bg-creme-100 transition font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-verde flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={12} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-verde text-white rounded-tr-sm"
                  : "bg-white border border-creme-100 text-gray-700 rounded-tl-sm shadow-sm"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-ambar flex items-center justify-center shrink-0 mt-0.5">
                <User size={12} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-full bg-verde flex items-center justify-center shrink-0">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-white border border-creme-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-verde animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-verde animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-verde animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-creme-100 bg-white flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Pergunte sobre seus dados…"
          disabled={loading}
          className="flex-1 text-sm border border-creme-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-verde/20 focus:border-verde transition disabled:opacity-50 bg-[#FAF8F5] placeholder-gray-300"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-xl bg-verde hover:bg-verde-900 text-white flex items-center justify-center transition disabled:opacity-40 shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </Card>
  );
}
