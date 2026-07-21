import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "../components/sidebar/Sidebar";
import HelpChat from "../components/ai/HelpChat";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileTabBar from "../components/mobile/MobileTabBar";
import DemoBanner from "../components/demo/DemoBanner";
import OverdueBanner from "../components/billing/OverdueBanner";

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // No mobile: sem sidebar/hambúrguer; navegação pela tab bar inferior.
  if (isMobile) {
    return (
      <div className="min-h-screen bg-creme-50 text-[#1F2937]">
        <DemoBanner />
        <OverdueBanner />
        <main className="min-h-screen pb-20">{children}</main>
        <MobileTabBar />
      </div>
    );
  }

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

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <DemoBanner />
        <OverdueBanner />
        <div className="p-4 sm:p-6 lg:p-8">
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
        </div>
      </main>

      <HelpChat />
    </div>
  );
}
