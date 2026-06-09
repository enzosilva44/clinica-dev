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
    <div className="bg-[#F5F1EA] border border-[#D8CDB9] rounded-2xl p-2 mb-6 flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-4 py-2 rounded-xl text-sm transition ${
            activeTab === tab.key
              ? "bg-[#1F4D46] text-white"
              : "text-[#1F4D46] hover:bg-[#E8E0D2]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}