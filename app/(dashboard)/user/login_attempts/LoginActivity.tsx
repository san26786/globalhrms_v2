"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MonitorSmartphone } from "lucide-react";
import { authFetch } from "@/lib/auth/authFetch";

export interface ActivityItem {
  id: number;
  title: string;
  lines: string[];
  badge?: string;
}

/** Shared card list for CI user/login_attempts (history) and activeSessions (online sessions). */
export default function LoginActivity({
  title,
  apiPath,
  toItem,
  tabs,
}: {
  title: string;
  apiPath: string;
  toItem: (row: Record<string, unknown>) => ActivityItem;
  tabs: Array<{ href: string; label: string; active: boolean }>;
}) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch(apiPath)
      .then((res) => res.json())
      .then((json) => (json.success ? setItems((json.data as Record<string, unknown>[]).map(toItem)) : setError(json.message)))
      .catch(() => setError("Failed to load login activity."));
    // toItem is a stable module-level mapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>User</span>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">{title}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <MonitorSmartphone className="text-blue-600" />
          <h1 className="text-4xl font-bold">{title}</h1>
        </div>
        <div className="mt-4 flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${t.active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && items === null && <p className="text-sm text-gray-400">Loading…</p>}
      {items?.length === 0 && <p className="text-sm text-gray-500">Nothing to show.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items?.map((item) => (
          <div key={item.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800 break-words">{item.title}</p>
              {item.badge && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{item.badge}</span>}
            </div>
            {item.lines.map((line) => (
              <p key={line} className="mt-1 text-sm text-slate-500 break-words">{line}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const LOGIN_ACTIVITY_TABS = (active: "history" | "sessions") => [
  { href: "/user/login_attempts", label: "Login Attempts", active: active === "history" },
  { href: "/user/login_attempts/activeSessions", label: "Active Sessions", active: active === "sessions" },
];
