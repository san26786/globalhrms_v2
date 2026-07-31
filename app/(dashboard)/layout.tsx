"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Dashboard"); // sensible default
  const [activeSubMenu, setActiveSubMenu] = useState<string | undefined>(undefined);
  const [activeBrand, setActiveBrand] = useState("Global HR India Ltd");

  // TODO: replace with real user data from your auth/session context
  const username = "Admin User";

  const handleSelectMenu = (menu: string, subMenu?: string) => {
    setActiveMenu(menu);
    setActiveSubMenu(subMenu);
  };

  const handleLogout = () => {
    // TODO: clear session/auth token here
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeMenu={activeMenu}
        activeSubMenu={activeSubMenu}
        onSelectMenu={handleSelectMenu}
        activeBrand={activeBrand}
      />

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Header */}
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          activeMenu={activeMenu}
          onSelectMenu={handleSelectMenu}
          onLogout={handleLogout}
          username={username}
          activeBrand={activeBrand}
          onBrandChange={setActiveBrand}
        />

        {/* Page Content */}
        <main className="p-2">{children}</main>
      </div>
    </div>
  );
}