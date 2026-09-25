"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import RouteGuard from "@/components/layout/RouteGuard";
import { NavigationProvider, useNavigation } from "@/lib/navigation/NavigationContext";
import { useHeaderSession } from "@/lib/header/useHeaderSession";

/**
 * Dashboard shell — CI include/main_page_v: header_v + left_menu_v + page body + footer_v.
 * The header session (brand, level, punch, alerts) is loaded once and shared with the sidebar;
 * the menu and the active location come from NavigationProvider.
 */

// CI left_menu_v: localStorage 'ghr_sidebar_expanded' = 'true' when the sidebar is expanded.
const SIDEBAR_KEY = "ghr_sidebar_expanded";
const SIDEBAR_EVENT = "ghr-sidebar-change";

function readSidebarExpanded(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "false"; // default: expanded
  } catch {
    return true;
  }
}

function subscribeSidebar(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

function setSidebarExpanded(expanded: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, String(expanded));
  } catch {
    // storage unavailable (private mode): the toggle still works for this page view
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

/** CI header_v <title><?php echo $title ?></title>: the active menu item's name. */
function DocumentTitle() {
  const { activeTrail } = useNavigation();
  const leaf = activeTrail[activeTrail.length - 1];
  useEffect(() => {
    document.title = leaf ? `${leaf.name} | Global HR` : "Global HR";
  }, [leaf]);
  return null;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const headerState = useHeaderSession();
  const expanded = useSyncExternalStore(subscribeSidebar, readSidebarExpanded, () => true);
  const isSidebarCollapsed = !expanded;
  const toggleSidebar = useCallback(() => setSidebarExpanded(!readSidebarExpanded()), []);

  // Ctrl/⌘ + B toggles the sidebar (shown on the collapse button).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <DocumentTitle />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        activeBrand={headerState.session.activeBrand?.name}
      />

      <div
        className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "ml-24" : "ml-64"
        }`}
      >
        {/* The header performs the logout request itself; nothing else to clear here. */}
        <Header sessionState={headerState} onLogout={() => undefined} />

        <main className="p-2">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <DashboardShell>{children}</DashboardShell>
    </NavigationProvider>
  );
}
