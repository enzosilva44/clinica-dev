import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "../components/sidebar/Sidebar";
import HelpChat from "../components/ai/HelpChat";

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-creme-50 text-[#1F2937]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 mb-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-creme-50 border border-creme-200 shadow-sm"
          >
            <Menu size={18} className="text-verde" />
          </button>
          <span className="text-base font-bold text-verde">Iasoclin</span>
        </div>
        {children}
      </main>

      <HelpChat />
    </div>
  );
}
