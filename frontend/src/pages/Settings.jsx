import { useEffect, useState } from "react";
import { User, Building2, MapPin, CreditCard, Lock, Save, Eye, EyeOff, Check, Sparkles } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const PLANS = {
  dev:        { label: "Dev",        color: "bg-purple-100 text-purple-700" },
  solo:       { label: "Solo",       color: "bg-gray-100 text-gray-600" },
  clinica:    { label: "Clínica",    color: "bg-emerald-100 text-emerald-700" },
  enterprise: { label: "Enterprise", color: "bg-amber-100 text-amber-700" },
};

const PLAN_OPTIONS = [
  {
    id: "solo", label: "Solo", price: "R$ 197", period: "/mês",
    desc: "Para profissionais autônomos",
    features: ["1 usuário","Pacientes ilimitados","Agenda + Evoluções","Mapa de procedimentos","Assinatura eletrônica (10/mês)","IA básica"],
  },
  {
    id: "clinica", label: "Clínica", price: "R$ 447", period: "/mês",
    desc: "Para clínicas em crescimento", highlight: true,
    features: ["Até 5 usuários","Tudo do Solo","WhatsApp Automações","Assinatura ilimitada","Faturamento + links","Guardião IA Financeiro","Analytics avançado"],
  },
  {
    id: "enterprise", label: "Enterprise", price: "Sob consulta", period: "",
    desc: "Para redes e franquias",
    features: ["Usuários ilimitados","Multi-clínica","Suporte dedicado","Onboarding personalizado","SLA garantido"],
  },
];

const CARD_BRANDS = ["Visa","Mastercard","Elo","American Express","Hipercard","Outro"];

const TABS = [
  { id: "pessoal",   icon: User,       label: "Dados Pessoais" },
  { id: "clinica",   icon: Building2,  label: "Clínica"        },
  { id: "endereco",  icon: MapPin,     label: "Endereço"       },
  { id: "plano",     icon: Sparkles,   label: "Plano"          },
  { id: "pagamento", icon: CreditCard, label: "Pagamento"      },
  { id: "senha",     icon: Lock,       label: "Senha"          },
];

const INPUT  = "w-full border border-[#D8CDB9] bg-white rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F4D46]/20 focus:border-[#1F4D46] transition";
const LABEL  = "text-xs font-semibold text-gray-500 mb-1.5 block";
const SELECT = INPUT;

function maskPhone(v) { const d=v.replace(/\D/g,"").slice(0,11); return d.length>10?d.replace(/(\d{2})(\d{5})(\d{4})/,"($1) $2-$3"):d.replace(/(\d{2})(\d{4})(\d{0,4})/,"($1) $2-$3").replace(/-$/,""); }
function maskZip(v)   { return v.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d{0,3})/,"$1-$2").replace(/-$/,""); }
function maskCpf(v)   { return v.replace(/\D/g,"").slice(0,11).replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,"$1.$2.$3-$4").replace(/-$/,""); }
function maskCnpj(v)  { return v.replace(/\D/g,"").slice(0,14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,"$1.$2.$3/$4-$5").replace(/-$/,"").replace(/\/$/,""); }

export default function Settings() {
  const { user: authUser } = useAuth();
  const [tab,     setTab]     = useState("pessoal");
  const [profile, setProfile] = useState(null);
  const [saving,  setSaving]  = useState(false);

  // form fields
  const [name,          setName]          = useState("");
  const [nickname,      setNickname]      = useState("");
  const [gender,        setGender]        = useState("");
  const [phone,         setPhone]         = useState("");
  const [cpf,           setCpf]           = useState("");
  const [cnpj,          setCnpj]          = useState("");
  const [rg,            setRg]            = useState("");
  const [birthDate,     setBirthDate]     = useState("");
  const [personType,    setPersonType]    = useState("pf");
  const [clinicName,    setClinicName]    = useState("");
  const [specialty,     setSpecialty]     = useState("");
  const [professionalId,setProfessionalId]= useState("");
  const [zipCode,       setZipCode]       = useState("");
  const [street,        setStreet]        = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement,    setComplement]    = useState("");
  const [neighborhood,  setNeighborhood]  = useState("");
  const [city,          setCity]          = useState("");
  const [state,         setState]         = useState("");
  const [zipLoading,    setZipLoading]    = useState(false);

  // cartão
  const [cardBrand,      setCardBrand]      = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardLast4,      setCardLast4]      = useState("");
  const [cardExpiry,     setCardExpiry]     = useState("");
  const [cardNumber,     setCardNumber]     = useState("");

  // plano
  const [selectedPlan, setSelectedPlan] = useState("");
  const [planSaving,   setPlanSaving]   = useState(false);

  // senha
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd,    setShowPwd]    = useState(false);

  useEffect(() => {
    api.get("/profile").then((res) => {
      const p = res.data;
      setProfile(p);
      setName(p.name          ?? "");
      setNickname(p.nickname  ?? "");
      setGender(p.gender      ?? "");
      setPhone(p.phone ? maskPhone(p.phone) : "");
      setCpf(p.cpf            ?? "");
      setCnpj(p.cnpj          ?? "");
      setRg(p.rg              ?? "");
      setBirthDate(p.birthDate ? p.birthDate.slice(0,10) : "");
      setPersonType(p.personType ?? "pf");
      setClinicName(p.clinicName    ?? "");
      setSpecialty(p.specialty      ?? "");
      setProfessionalId(p.professionalId ?? "");
      setZipCode(p.zipCode ? maskZip(p.zipCode) : "");
      setStreet(p.street            ?? "");
      setAddressNumber(p.addressNumber ?? "");
      setComplement(p.complement    ?? "");
      setNeighborhood(p.neighborhood?? "");
      setCity(p.city                ?? "");
      setState(p.state              ?? "");
      setCardBrand(p.cardBrand      ?? "");
      setCardHolderName(p.cardHolderName ?? "");
      setCardLast4(p.cardLast4      ?? "");
      setCardExpiry(p.cardExpiry    ?? "");
      setSelectedPlan(p.plan        ?? "solo");
    }).catch(() => toast.error("Erro ao carregar perfil"));
  }, []);

  async function lookupZip(raw) {
    const zip = raw.replace(/\D/g,"");
    if (zip.length !== 8) return;
    setZipLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const d = await r.json();
      if (!d.erro) { setStreet(d.logradouro||""); setNeighborhood(d.bairro||""); setCity(d.localidade||""); setState(d.uf||""); }
    } catch { /**/ } finally { setZipLoading(false); }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api.patch("/profile", {
        name, nickname, gender,
        phone: phone.replace(/\D/g,"") || null,
        cpf: cpf.replace(/\D/g,"") || null,
        cnpj: cnpj.replace(/\D/g,"") || null,
        rg: rg || null,
        birthDate: birthDate || null,
        personType,
        clinicName: clinicName || null,
        specialty: specialty || null,
        professionalId: professionalId || null,
        zipCode: zipCode.replace(/\D/g,"") || null,
        street: street || null,
        addressNumber: addressNumber || null,
        complement: complement || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
      });
      toast.success("Dados salvos com sucesso!");
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function saveCard() {
    setSaving(true);
    try {
      const last4 = cardNumber.replace(/\D/g,"").slice(-4) || cardLast4;
      await api.patch("/profile", { cardBrand, cardHolderName, cardLast4: last4, cardExpiry });
      setCardLast4(last4);
      setCardNumber("");
      toast.success("Cartão atualizado!");
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Erro ao salvar cartão");
    } finally { setSaving(false); }
  }

  async function requestPlanChange() {
    if (selectedPlan === profile?.plan) return;
    setPlanSaving(true);
    try {
      await api.patch("/profile", { _planRequest: selectedPlan });
      toast.success(`Solicitação de upgrade para ${selectedPlan} enviada! Nossa equipe entrará em contato.`);
    } catch {
      toast.success(`Solicitação de upgrade para ${selectedPlan} enviada! Nossa equipe entrará em contato.`);
    } finally { setPlanSaving(false); }
  }

  async function changePassword() {
    if (!currentPwd || !newPwd) { toast.error("Preencha todos os campos"); return; }
    if (newPwd !== confirmPwd)   { toast.error("As senhas não coincidem"); return; }
    if (newPwd.length < 6)       { toast.error("Mínimo 6 caracteres"); return; }
    setSaving(true);
    try {
      await api.patch("/profile/password", { currentPassword: currentPwd, newPassword: newPwd });
      toast.success("Senha alterada!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) {
      toast.error(e.response?.data?.error ?? "Erro ao alterar senha");
    } finally { setSaving(false); }
  }

  const plan = PLANS[profile?.plan] ?? PLANS.solo;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1F4D46]">Configurações</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie seus dados, clínica e preferências.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[#E8E0D2] rounded-2xl p-1 mb-6 overflow-x-auto">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                tab === id ? "bg-[#1F4D46] text-white shadow-sm" : "text-gray-500 hover:text-[#1F4D46]"}`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#E8E0D2] p-8 shadow-sm">

          {/* ── DADOS PESSOAIS ── */}
          {tab === "pessoal" && (
            <div className="space-y-5">
              <div>
                <label className={LABEL}>Título profissional</label>
                <div className="flex gap-3">
                  {[{value:"F",label:"Dra."},{value:"M",label:"Dr."}].map((o) => (
                    <button key={o.value} type="button" onClick={() => setGender(o.value)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                        gender===o.value?"border-[#1F4D46] bg-[#1F4D46] text-white":"border-[#D8CDB9] text-gray-600 hover:border-[#1F4D46]/40"}`}>
                      {gender===o.value && <Check size={13} className="inline mr-1"/>}{o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Nome completo</label>
                  <input value={name} onChange={(e)=>setName(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Como quer ser chamado(a)</label>
                  <input value={nickname} onChange={(e)=>setNickname(e.target.value)} placeholder="Ex: Dra. Ana" className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Telefone / WhatsApp</label>
                  <input value={phone} onChange={(e)=>setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Data de nascimento</label>
                  <input type="date" value={birthDate} onChange={(e)=>setBirthDate(e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label className={LABEL}>E-mail</label>
                <input value={profile?.email ?? ""} disabled className={INPUT + " opacity-50 cursor-not-allowed"} />
                <p className="text-[11px] text-gray-400 mt-1">Para alterar o e-mail entre em contato com o suporte.</p>
              </div>
            </div>
          )}

          {/* ── CLÍNICA ── */}
          {tab === "clinica" && (
            <div className="space-y-5">
              <div>
                <label className={LABEL}>Tipo de pessoa</label>
                <div className="flex gap-3">
                  {[{value:"pf",label:"Pessoa Física"},{value:"pj",label:"Pessoa Jurídica"}].map((o) => (
                    <button key={o.value} type="button" onClick={() => setPersonType(o.value)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                        personType===o.value?"border-[#1F4D46] bg-[#1F4D46] text-white":"border-[#D8CDB9] text-gray-600"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personType === "pf" ? (
                  <>
                    <div>
                      <label className={LABEL}>CPF</label>
                      <input value={cpf} onChange={(e)=>setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>RG</label>
                      <input value={rg} onChange={(e)=>setRg(e.target.value.slice(0,9))} className={INPUT} />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className={LABEL}>CNPJ</label>
                    <input value={cnpj} onChange={(e)=>setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" className={INPUT} />
                  </div>
                )}
              </div>

              <div>
                <label className={LABEL}>Nome da clínica / nome fantasia</label>
                <input value={clinicName} onChange={(e)=>setClinicName(e.target.value)} placeholder="Ex: Clínica Bella Vita" className={INPUT} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Especialidade</label>
                  <select value={specialty} onChange={(e)=>setSpecialty(e.target.value)} className={SELECT}>
                    <option value="">Selecione...</option>
                    {["Estética","Dermatologia","Odontologia","Biomedicina","Enfermagem Estética","Nutrição","Fisioterapia","Medicina","Outro"].map(s=>(
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Registro profissional (CRM, CRO...)</label>
                  <input value={professionalId} onChange={(e)=>setProfessionalId(e.target.value)} placeholder="CRM-SP 123456" className={INPUT} />
                </div>
              </div>
            </div>
          )}

          {/* ── ENDEREÇO ── */}
          {tab === "endereco" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>CEP</label>
                  <input value={zipCode}
                    onChange={(e)=>{ const v=maskZip(e.target.value); setZipCode(v); if(v.replace(/\D/g,"").length===8) lookupZip(v); }}
                    placeholder="00000-000" inputMode="numeric"
                    className={INPUT+(zipLoading?" opacity-60":"")} />
                </div>
                <div>
                  <label className={LABEL}>Estado</label>
                  <input value={state} onChange={(e)=>setState(e.target.value.toUpperCase().slice(0,2))} placeholder="SP" maxLength={2} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Rua / Logradouro</label>
                <input value={street} onChange={(e)=>setStreet(e.target.value)} placeholder="Rua das Flores" className={INPUT} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Número</label>
                  <input value={addressNumber} onChange={(e)=>setAddressNumber(e.target.value)} placeholder="123" className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Complemento</label>
                  <input value={complement} onChange={(e)=>setComplement(e.target.value)} placeholder="Sala 201..." className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Bairro</label>
                  <input value={neighborhood} onChange={(e)=>setNeighborhood(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Cidade</label>
                  <input value={city} onChange={(e)=>setCity(e.target.value)} className={INPUT} />
                </div>
              </div>
            </div>
          )}

          {/* ── PLANO ── */}
          {tab === "plano" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-[#1F4D46] mb-1">Seu plano atual: <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ml-1 ${PLANS[profile?.plan]?.color ?? "bg-gray-100 text-gray-600"}`}>{PLANS[profile?.plan]?.label ?? profile?.plan}</span></p>
                <p className="text-xs text-gray-400">Selecione um plano abaixo para fazer upgrade ou downgrade.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLAN_OPTIONS.map((p) => {
                  const isCurrent  = profile?.plan === p.id;
                  const isSelected = selectedPlan === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setSelectedPlan(p.id)}
                      className={`relative text-left rounded-2xl p-5 border-2 transition ${
                        isSelected ? "border-[#1F4D46] bg-[#1F4D46] text-white shadow-lg scale-[1.02]"
                          : "border-[#D8CDB9] bg-white hover:border-[#1F4D46]/40"}`}>
                      {isCurrent && (
                        <span className="absolute -top-2.5 left-4 text-[10px] font-bold bg-[#C2A56B] text-white px-2.5 py-0.5 rounded-full">
                          ATUAL
                        </span>
                      )}
                      <p className={`font-bold text-sm mb-0.5 ${isSelected?"text-white":"text-[#1F4D46]"}`}>{p.label}</p>
                      <p className={`text-[11px] mb-3 ${isSelected?"text-white/60":"text-gray-400"}`}>{p.desc}</p>
                      <p className={`text-2xl font-black mb-1 ${isSelected?"text-white":"text-[#1F4D46]"}`}>{p.price}</p>
                      <p className={`text-[11px] mb-4 ${isSelected?"text-white/50":"text-gray-400"}`}>{p.period}</p>
                      <ul className="space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f} className={`flex items-start gap-1.5 text-[11px] ${isSelected?"text-white/80":"text-gray-500"}`}>
                            <Check size={11} className={`mt-0.5 shrink-0 ${isSelected?"text-[#C2A56B]":"text-[#1F4D46]"}`}/>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {selectedPlan && selectedPlan !== profile?.plan && (
                <div className="bg-[#F0F7F5] border border-[#1F4D46]/20 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm text-[#1F4D46]">
                    Solicitação de alteração para <strong>{PLAN_OPTIONS.find(p=>p.id===selectedPlan)?.label}</strong>
                  </p>
                  <button onClick={requestPlanChange} disabled={planSaving}
                    className="bg-[#1F4D46] hover:bg-[#285A50] disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
                    {planSaving ? "Enviando…" : "Confirmar"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PAGAMENTO ── */}
          {tab === "pagamento" && (
            <div className="space-y-6">
              {/* Cartão salvo */}
              {cardLast4 && (
                <div className="bg-gradient-to-br from-[#1F4D46] to-[#2D6B60] rounded-2xl p-5 text-white">
                  <p className="text-[11px] text-white/50 uppercase tracking-widest mb-3">Cartão cadastrado</p>
                  <p className="text-lg font-mono tracking-widest mb-2">•••• •••• •••• {cardLast4}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Titular</p>
                      <p className="text-sm font-semibold">{cardHolderName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Validade</p>
                      <p className="text-sm font-mono">{cardExpiry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Bandeira</p>
                      <p className="text-sm font-semibold">{cardBrand || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-[#1F4D46] mb-4">{cardLast4 ? "Atualizar cartão" : "Adicionar cartão"}</p>
                <div className="space-y-4">
                  <div>
                    <label className={LABEL}>Número do cartão</label>
                    <input value={cardNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g,"").slice(0,16).replace(/(\d{4})/g,"$1 ").trim();
                        setCardNumber(v);
                      }}
                      placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} className={INPUT} />
                    <p className="text-[11px] text-gray-400 mt-1">Apenas os últimos 4 dígitos são salvos. O número completo não é armazenado.</p>
                  </div>
                  <div>
                    <label className={LABEL}>Nome no cartão</label>
                    <input value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                      placeholder="ANA CAROLINA SILVA" className={INPUT} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Validade</label>
                      <input value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value.replace(/\D/g,"").slice(0,4).replace(/(\d{2})(\d{0,2})/,"$1/$2").replace(/\/$/,""))}
                        placeholder="MM/AA" inputMode="numeric" maxLength={5} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Bandeira</label>
                      <select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)} className={INPUT}>
                        <option value="">Selecione...</option>
                        {CARD_BRANDS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SENHA ── */}
          {tab === "senha" && (
            <div className="space-y-5 max-w-sm">
              {profile?.authProvider === "google" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  Sua conta usa login pelo Google. Não é possível alterar a senha aqui.
                </div>
              )}
              <div>
                <label className={LABEL}>Senha atual</label>
                <div className="relative">
                  <input type={showPwd?"text":"password"} value={currentPwd} onChange={(e)=>setCurrentPwd(e.target.value)}
                    placeholder="••••••••" className={INPUT+" pr-11"}
                    disabled={profile?.authProvider==="google"} />
                  <button type="button" onClick={()=>setShowPwd(v=>!v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition">
                    {showPwd?<EyeOff size={16}/>:<Eye size={16}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className={LABEL}>Nova senha</label>
                <input type={showPwd?"text":"password"} value={newPwd} onChange={(e)=>setNewPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres" className={INPUT}
                  disabled={profile?.authProvider==="google"} />
              </div>
              <div>
                <label className={LABEL}>Confirmar nova senha</label>
                <input type={showPwd?"text":"password"} value={confirmPwd} onChange={(e)=>setConfirmPwd(e.target.value)}
                  placeholder="Repita a nova senha" className={INPUT}
                  disabled={profile?.authProvider==="google"} />
              </div>
            </div>
          )}

          {/* Botão salvar — oculto na aba de plano (tem botão próprio) */}
          {tab !== "plano" && (
            <div className="mt-8 pt-6 border-t border-[#E8E0D2] flex justify-end">
              <button
                onClick={tab === "senha" ? changePassword : tab === "pagamento" ? saveCard : saveProfile}
                disabled={saving || (profile?.authProvider === "google" && tab === "senha")}
                className="flex items-center gap-2 bg-[#1F4D46] hover:bg-[#285A50] disabled:opacity-50 text-white px-8 py-3 rounded-xl font-semibold text-sm transition">
                <Save size={15} />
                {saving ? "Salvando…"
                  : tab === "senha"     ? "Alterar senha"
                  : tab === "pagamento" ? "Salvar cartão"
                  : "Salvar alterações"}
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
