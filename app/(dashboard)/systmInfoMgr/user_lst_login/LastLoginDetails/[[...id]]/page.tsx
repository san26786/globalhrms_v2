"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";
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
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>System Information</span>
          <ChevronRight size={15} className="text-slate-400" />
          <Link href="/systmInfoMgr/user_lst_login">Last Login Details</Link>
          <ChevronRight size={15} className="text-slate-400" />
          <span className="font-semibold text-blue-600">View</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Eye className="text-blue-600 h-6 w-6" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">Last Login Details</h1>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !data && <p className="text-sm text-gray-400">Loading…</p>}
        {data && (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-sm font-medium text-slate-600 sm:text-right">{label}</dt>
                <dd className="text-sm text-slate-800 sm:col-span-3 break-words">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
