"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GlobalHRLogo from "@/components/auth/GlobalHRLogo";

/** Shared shell for the public account-recovery pages (same visual language as the login screen). */
export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <GlobalHRLogo />
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
        <Link href="/login" className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-500">
          <ArrowLeft className="w-3.5 h-3.5" /> Go back to Login
        </Link>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";
export const buttonClass =
  "w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold text-xs py-4 px-4 rounded-xl shadow-lg shadow-blue-200/50 transition-all";

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; message: string; errors?: Record<string, string[]> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    return {
      ok: res.ok && json.success,
      message: json.success ? (json.data?.message ?? "") : (json.message ?? "Request failed."),
      errors: json.errors,
    };
  } catch {
    return { ok: false, message: "Unable to reach the server. Please try again." };
  }
}
