"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="bg-white border-b border-slate-200 sticky top-20 z-30 py-3 shadow-sm mb-3">
      <div className="grid grid-cols-[48px_1fr_48px] items-center px-4">
        {/* Left Arrow */}
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous tab"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-slate-50 hover:text-blue-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Center Tabs */}
        <div className="flex justify-center overflow-x-auto">
          <div className="flex rounded-full bg-slate-100 p-1 shadow-inner">
            {tabs.map((tab, i) => {
              const active = i === currentIndex;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                    active ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {active && <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />}
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-slate-50 hover:text-blue-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
