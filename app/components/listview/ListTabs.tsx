"use client";

import Link from "next/link";

/**
 * CI include/tabs_v: a row of links above a list (e.g. All / Approval Pending / Approved / Rejected).
 * Each tab is a page link; `active` is the key of the current one.
 */
export interface ListTab {
  key: string;
  label: string;
  href: string;
}

export default function ListTabs({ tabs, active, label = "Sections" }: { tabs: ListTab[]; active: string; label?: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#111a2e]">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-medium brand:transition-colors brand:duration-200 ${
            t.key === active
              ? "bg-blue-600 text-white brand:bg-[#e15425] brand:shadow-[0_8px_18px_-10px_rgba(225,84,37,0.8)]"
              : "text-slate-600 hover:bg-slate-100 brand:text-[#323338] brand:hover:bg-[#f1f3f8] dark:text-[#d5dae4] dark:hover:bg-white/10"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
