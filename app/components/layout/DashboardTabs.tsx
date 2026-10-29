"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { poppins } from "@/components/auth/AuthUi";
import { ThemeScope } from "@/components/dashboard/DashboardUi";
import { useNavigation } from "@/lib/navigation/NavigationContext";

/**
 * Module tabs (CI include/tabs_v fed by dashboardnew_m->getChildMenu / $show_tabs): the sibling
 * screens of the current page, taken from the caller's permission-filtered menu — so a user sees
 * exactly the tabs whose menu items they are granted, in menu order. Screens not migrated yet are
 * not offered as tabs.
 */
export default function DashboardTabs() {
  const router = useRouter();
  const { activeTrail, isActive } = useNavigation();

  const parent = activeTrail.length > 1 ? activeTrail[activeTrail.length - 2] : null;
  const tabs = (parent?.children ?? []).flatMap((node) =>
    node.link.kind === "internal" ? [{ id: node.id, title: node.name, href: node.link.href, node }] : [],
  );

  if (tabs.length === 0) return null;

  const currentIndex = tabs.findIndex((tab) => isActive(tab.node));
  const go = (step: number) => {
    const from = currentIndex < 0 ? 0 : currentIndex;
    router.push(tabs[(from + step + tabs.length) % tabs.length].href);
  };

  return (
    <ThemeScope contents>
    <div className={`${poppins.className} sticky top-20 z-30 mb-5 rounded-2xl bg-white/85 dark:bg-[#0f1729]/85 py-2.5 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_10px_30px_-22px_rgba(6,27,49,0.45)] backdrop-blur`}>
      <div className="grid grid-cols-[48px_1fr_48px] items-center px-4">
        {/* Left Arrow */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous tab"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] text-[#323338] dark:text-[#d5dae4] shadow-sm transition-all duration-300 hover:scale-110 hover:border-[#da5427]/40 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 hover:text-[#7a2e12] dark:hover:text-[#f8d3c3] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Center Tabs */}
        <div className="flex justify-center overflow-x-auto">
          <div className="flex rounded-full bg-[#f1f3f8] dark:bg-white/5 p-1">
            {tabs.map((tab, i) => {
              const active = i === currentIndex;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-full px-5 py-2.5 text-[14px] font-medium transition-colors duration-300 whitespace-nowrap ${
                    active ? "text-white" : "text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="dashboard-tab-pill"
                      className="absolute inset-0 rounded-full bg-[#e15425] shadow-[0_8px_18px_-10px_rgba(225,84,37,0.8)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {active && <span className="h-2 w-2 rounded-full bg-white/90 animate-pulse" />}
                    {tab.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next tab"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] text-[#323338] dark:text-[#d5dae4] shadow-sm transition-all duration-300 hover:scale-110 hover:border-[#da5427]/40 hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 hover:text-[#7a2e12] dark:hover:text-[#f8d3c3] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    </ThemeScope>
  );
}
