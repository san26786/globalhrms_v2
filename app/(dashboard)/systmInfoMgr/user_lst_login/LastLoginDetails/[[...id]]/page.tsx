"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Eye,
  Globe,
  MapPin,
  MonitorSmartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { authFetch } from "@/lib/auth/authFetch";

interface LastLogin {
  userName: string | null;
  lastLoginAt: string;
  ipAddress: string | null;
  location: string | null;
  userAgent: string | null;
  status: string | null;
  organisation: string | null;
  brand: string | null;
}

/**
 * CI systmInfoMgr/user_lst_login/LastLoginDetails[/{id}] — read-only view of one login
 * (the caller's latest when no id is given; header menu "View Last Login Details").
 */
export default function LastLoginDetailsPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const { id } = use(params);
  const entryId = id?.[0];
  const [data, setData] = useState<LastLogin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = entryId ? `/api/systmInfoMgr/user_lst_login/${encodeURIComponent(entryId)}` : "/api/systmInfoMgr/user_lst_login/latest";
    authFetch(url)
      .then((res) => res.json())
      .then((json) => (json.success ? setData(json.data) : setError(json.message ?? "Failed to load login details.")))
      .catch(() => setError("Failed to load login details."));
  }, [entryId]);

  const rows: Array<[string, string | null]> = data
    ? [
        ["Username", data.userName],
        ["Organisation", data.organisation],
        ["Brand", data.brand],
        ["Last Login At", new Date(data.lastLoginAt).toLocaleString()],
        ["Last Logged In IP", data.ipAddress],
        ["Approx. Location", data.location],
        ["Browser", data.userAgent],
        ["Status", data.status],
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
      {/* Header card */}
      <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] before:absolute before:inset-x-8 before:top-0 before:h-1 before:rounded-b-full before:bg-gradient-to-r before:from-[#e15425] before:to-[#0b5394] dark:border-white/10 dark:bg-[#111a2e]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[14px] text-[#535768] dark:text-[#aab3c5]">
              <span>System Information</span>
              <ChevronRight aria-hidden="true" size={15} />
              <Link href="/systmInfoMgr/user_lst_login" className="rounded underline-offset-4 transition-colors hover:text-[#0b5394] hover:underline dark:hover:text-[#8cb8f0]">
                Last Login Details
              </Link>
              <ChevronRight aria-hidden="true" size={15} />
              <span aria-current="page" className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">
                View
              </span>
            </nav>
            <div className="mt-3 flex items-center gap-3">
              <Eye aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl bg-[#fbe6dd] p-2.5 text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]" />
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#1a1818] dark:text-[#f1f3f8] md:text-[32px]">Last Login Details</h1>
            </div>
          </div>
          <Link
            href="/systmInfoMgr/user_lst_login"
            className="group inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-[14px] font-medium text-[#1a1818] transition-colors hover:border-slate-400 hover:bg-[#f6f7f9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5394]/20 dark:border-white/15 dark:text-[#f1f3f8] dark:hover:border-white/25 dark:hover:bg-white/5"
          >
            See login history
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-rose-50 px-5 py-4 text-[14px] font-medium text-rose-800 ring-1 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-400/30">
          <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          {error}
        </p>
      )}

      {!error && !data && (
        <div aria-busy="true" aria-label="Loading…" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5 sm:col-span-2 lg:col-span-4" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/5" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* The sign-in at a glance */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.515, 0.147, 0.25, 1] }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1f44] via-[#0b3a6e] to-[#0b4a85] p-6 text-white shadow-[0_24px_48px_-28px_rgba(6,27,49,0.75)] sm:p-8"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#da5427]/30 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-widest text-[#f8d3c3]">Signed in</p>
                <p className="mt-1 text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[32px]">{new Date(data.lastLoginAt).toLocaleString()}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[14px]">
                  {data.ipAddress && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                      <Globe aria-hidden="true" className="h-4 w-4" />
                      {data.ipAddress}
                    </span>
                  )}
                  {data.location && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                      <MapPin aria-hidden="true" className="h-4 w-4" />
                      {data.location}
                    </span>
                  )}
                </div>
              </div>
              {data.status && <StatusPill status={data.status} />}
            </div>
          </motion.section>

          {/* Every detail of the login */}
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map(([label, value], i) => {
              const Icon = ROW_ICONS[label] ?? Activity;
              return (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: [0.515, 0.147, 0.25, 1] }}
                  className={`rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.3)] dark:bg-[#111a2e] dark:ring-white/10 ${label === "Browser" ? "sm:col-span-2" : ""}`}
                >
                  <dt className="flex items-center gap-2 text-[13px] font-medium text-[#535768] dark:text-[#aab3c5]">
                    <Icon aria-hidden="true" className="h-4 w-4 text-[#0b5394] dark:text-[#8cb8f0]" />
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-[15px] font-medium text-[#1a1818] dark:text-[#f1f3f8]">{value || "—"}</dd>
                </motion.div>
              );
            })}
          </dl>
        </>
      )}
    </div>
  );
}

const ROW_ICONS: Record<string, LucideIcon> = {
  Username: UserRound,
  Organisation: Building2,
  Brand: BadgeCheck,
  "Last Login At": CalendarClock,
  "Last Logged In IP": Globe,
  "Approx. Location": MapPin,
  Browser: MonitorSmartphone,
  Status: Activity,
};

/** The login's status as a coloured pill (colour only; the text is shown as received). */
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = /fail|invalid|lock|denied|block/.test(s)
    ? "bg-rose-50 text-rose-800 ring-rose-200"
    : /success|active|ok|logged/.test(s)
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : "bg-white/90 text-[#1a1818] ring-white/40";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold ring-1 ${tone}`}>
      <Activity aria-hidden="true" className="h-4 w-4" />
      {status}
    </span>
  );
}
