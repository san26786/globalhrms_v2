"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const tabs = [
  {
    title: "Employee Dashboard",
    href: "/dashboard",
  },
  {
    title: "Attendance Dashboard",
    href: "/dashboard/attendance",
  },
  {
    title: "Leave Dashboard",
    href: "/dashboard/leave",
  },
  {
    title: "Timesheet Dashboard",
    href: "/dashboard/timesheet",
  },
];

export default function DashboardTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = tabs.findIndex((tab) => tab.href === pathname);

  const handleNextTab = () => {
    const nextIndex = (currentIndex + 1) % tabs.length;
    router.push(tabs[nextIndex].href);
  };

  const handlePrevTab = () => {
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    router.push(tabs[prevIndex].href);
  };

  return (
    <div className="bg-white border-b border-slate-200 sticky top-20 z-30 py-3 shadow-sm mb-3">
    <div className="grid grid-cols-[48px_1fr_48px] items-center px-4">

      {/* Left Arrow */}
      <div className="flex justify-start">
        <button
          onClick={handlePrevTab}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-slate-50 hover:text-blue-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Center Tabs */}
      <div className="flex justify-center overflow-x-auto">
        <div className="flex rounded-full bg-slate-100 p-1 shadow-inner">
          {tabs.map((tab) => {
            const active = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  active
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                <span className="flex items-center gap-2">
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  )}
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
          onClick={handleNextTab}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-slate-50 hover:text-blue-600"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  </div>
  );
}