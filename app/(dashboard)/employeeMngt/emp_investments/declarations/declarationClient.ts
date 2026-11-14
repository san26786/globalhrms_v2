"use client";

import { toast } from "sonner";

import { authFetch } from "@/lib/auth/authFetch";
import type { SaveResult } from "@/lib/payroll/declarations/declarationTypes";

/** The declaration APIs (lib/payroll/declarations/declarationService.ts). */
export const declarationApi = (id: number | string) => `/api/employeeMngt/emp_investment_declarations/${encodeURIComponent(String(id))}`;

export type FieldErrors = Record<string, string>;

/** Calls a section API; success → toast (and its warnings); failure → toast + the field errors. */
export async function sectionCall(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; result: SaveResult } | { ok: false; errors: FieldErrors }> {
  try {
    const res = await authFetch(url, init);
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: SaveResult; errors?: Record<string, string[]> } | null;
    if (!res.ok || !json?.success || !json.data) {
      toast.error(json?.message ?? "Save failed.");
      return { ok: false, errors: Object.fromEntries(Object.entries(json?.errors ?? {}).map(([k, v]) => [k, v[0]])) };
    }
    toast.success(json.data.message);
    for (const w of json.data.warnings) toast.warning(w, { duration: 10000 });
    return { ok: true, result: json.data };
  } catch {
    toast.error("Save failed.");
    return { ok: false, errors: {} };
  }
}

export const saveSectionCall = (id: number, code: string, body: FormData) => sectionCall(`${declarationApi(id)}/${code}`, { method: "POST", body });
export const resetSectionCall = (id: number, code: string) => sectionCall(`${declarationApi(id)}/${code}`, { method: "DELETE" });
export const removeMedicalCall = (id: number, row: number) => sectionCall(`${declarationApi(id)}/medical/${row}`, { method: "DELETE" });

/** A section's picture as an object URL (null when it is not a picture or cannot be read). */
export async function attachmentBlob(id: number, slot: string): Promise<{ url: string; image: boolean } | null> {
  const res = await authFetch(`${declarationApi(id)}/file?slot=${encodeURIComponent(slot)}`);
  if (!res.ok) return null;
  const image = !!res.headers.get("Content-Type")?.startsWith("image/");
  return { url: URL.createObjectURL(await res.blob()), image };
}

/** Downloads a section's picture. */
export async function downloadAttachment(id: number, slot: string, name: string) {
  const file = await attachmentBlob(id, slot);
  if (!file) {
    toast.error("Document Not Found!!");
    return;
  }
  const a = Object.assign(document.createElement("a"), { href: file.url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(file.url), 1000);
}

/** Indian digit grouping, up to 2 decimals (CI showed the stored figure). */
export const amountText = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "0";
  const n = Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) : String(v);
};
