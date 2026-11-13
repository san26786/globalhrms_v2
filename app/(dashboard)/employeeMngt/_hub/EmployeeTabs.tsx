"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI include/emp_tabs_v + the "Next Tab" chevron (formview_v / listview_v, js/customscrolltabs.js): an employee's tabs —
 * Personal and their Employee Hub screens the caller may open — on the Personal form and on every record list opened for
 * one employee. The tab of the current page is highlighted; "Next Tab" goes to the one after it.
 * Server: GET /api/employeeMngt/emp_mst/{id}/tabs (lib/navigation/navigationService.ts getEmployeeTabs).
 */
export interface EmployeeTab {
  label: string;
  href: string;
}

const pathOf = (href: string) => href.split("?")[0];

/** `personal`: which Personal form the first tab opens (Employee Manager edit, Team edit, or My Info). */
export function useEmployeeTabs(emp?: string | null, personal?: "team" | "me"): { strip: ReactNode; nextHref?: string } {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<{ key: string; tabs: EmployeeTab[] } | null>(null);
  const key = emp && /^\d+$/.test(emp) ? `${emp}|${personal ?? ""}` : null;

  useEffect(() => {
    if (!key) return;
    let live = true;
    const [id, p] = key.split("|");
    authFetch(`/api/employeeMngt/emp_mst/${id}/tabs${p ? `?personal=${p}` : ""}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: { tabs: EmployeeTab[] } }) => {
        if (live) setLoaded({ key, tabs: json?.success && json.data ? json.data.tabs : [] });
      })
      .catch(() => live && setLoaded({ key, tabs: [] }));
    return () => {
      live = false;
    };
  }, [key]);

  const tabs = key && loaded?.key === key ? loaded.tabs : [];
  if (tabs.length < 2) return { strip: null };
  // The current page's tab: its list, or a form under it (add / edit).
  const active = tabs.findIndex((t) => pathname === pathOf(t.href) || (pathOf(t.href) !== "/" && pathname.startsWith(`${pathOf(t.href)}/`) && !tabs.some((o) => o !== t && pathname === pathOf(o.href))));
  const nextHref = active >= 0 && active + 1 < tabs.length ? tabs[active + 1].href : undefined;

  const strip = (
    <nav aria-label="Employee tabs" className="overflow-x-auto rounded-2xl border bg-white px-2 py-1.5 shadow-sm brand:border-slate-200 dark:border-white/10 dark:bg-[#111a2e]">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t, i) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={i === active ? "page" : undefined}
              className={
                i === active
                  ? "block rounded-xl bg-[#fbe6dd] px-3 py-1.5 text-[13px] font-semibold text-[#b4441f] dark:bg-[#da5427]/20 dark:text-[#f8a27e]"
                  : "block rounded-xl px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-100 dark:text-[#c3cad6] dark:hover:bg-white/5"
              }
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  return { strip, nextHref };
}

/** The tab strip with CI's "Next Tab" button beside it — for forms (lists put Next Tab in their header). */
export function EmployeeTabStrip({ emp, personal }: { emp?: string | null; personal?: "team" | "me" }) {
  const { strip, nextHref } = useEmployeeTabs(emp, personal);
  if (!strip) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{strip}</div>
      {nextHref ? (
        <Link
          href={nextHref}
          title="Next Tab"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-3 text-[13px] text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-[#d5dae4] dark:hover:bg-white/5"
        >
          Next Tab <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
