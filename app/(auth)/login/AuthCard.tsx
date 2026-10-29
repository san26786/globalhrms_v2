"use client";

import type { LucideIcon } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthUi";

/** Shared shell for the public account-recovery pages (same visual language as the login screen). */
export default function AuthCard({
  icon,
  title,
  subtitle,
  footer,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Shown next to "Back to login", e.g. a link to the other recovery page. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AuthShell icon={icon} title={title} subtitle={subtitle} footer={footer}>
      {children}
    </AuthShell>
  );
}

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
