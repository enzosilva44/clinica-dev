const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "photos", label: "Fotos" },
  { key: "budgets", label: "Orçamentos" },
  { key: "documents", label: "Documentos" },
  { key: "clinical", label: "Clínico" },
  { key: "appointments", label: "Agendamentos" },
];

export default function PatientTabs({ activeTab, setActiveTab }) {
  return (
    <div className="bg-[#F2F0EB] border border-[#DDD8CC] rounded-2xl p-2 mb-6 flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-4 py-2 rounded-xl text-sm transition ${
            activeTab === tab.key
              ? "bg-[#00704A] text-white"
              : "text-[#00704A] hover:bg-[#E6E2D8]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}