import { authFetch } from "@/lib/auth/authFetch";
import type { ExitDocument } from "@/lib/employeeMngt/exitDocuments";
import { EXIT_STEPS, type ExitStepKey } from "@/lib/employeeMngt/hub/defs/exit_clearance";
import { hubBase } from "@/lib/employeeMngt/hub/hubTypes";

/**
 * Client helpers of the exit clearance pages: where each department's step lives, the employee's records,
 * and the clearance's PDFs (API: /api/department_activity/department_head_supervisor/{id}/{document},
 * rules in lib/employeeMngt/exitDocuments).
 */
export const LIST = hubBase("exit_clearance");
const DOCUMENTS_API = "/api/department_activity/department_head_supervisor";

/** The step's own page for the employee: picks edit or add (steps 2–5). */
export const stepEntry = (key: ExitStepKey, emp: string) => `${hubBase(key)}?emp=${encodeURIComponent(emp)}`;

/** Where a save of `key` goes: the next department, or back to the list after the last one. */
export function nextAfter(key: ExitStepKey, emp: string): string {
  const i = EXIT_STEPS.findIndex((s) => s.key === key);
  const following = EXIT_STEPS[i + 1];
  return following ? stepEntry(following.key, emp) : LIST;
}

/** The step's form for the employee: their record, or a new one. */
export const formHref = (key: ExitStepKey, emp: string, id: number | null) =>
  `${hubBase(key)}/${id ? `edit/${id}` : "add"}?emp=${encodeURIComponent(emp)}`;

type ListJson = { success?: boolean; data?: Array<Record<string, unknown> & { id: number }>; permissions?: { create?: boolean; update?: boolean }; message?: string };

async function firstRecord(key: ExitStepKey, emp: string): Promise<ListJson> {
  const res = await authFetch(`/api/employeeMngt/${key}?${new URLSearchParams({ emp, page: "1", limit: "1" })}`);
  const json = (await res.json().catch(() => null)) as ListJson | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not load the exit clearance.");
  return json;
}

/** The employee's live record of the step, if any. */
export async function stepRecord(key: ExitStepKey, emp: string): Promise<number | null> {
  return (await firstRecord(key, emp)).data?.[0]?.id ?? null;
}

export interface ClearanceState {
  /** The clearance (Department Head / Supervisor record), if started. */
  id: number | null;
  /** CI IS_GENERATED: the exit form was generated. */
  generated: boolean;
  /** The caller may add / edit the steps (admins with the menu's grant; the steps share one menu). */
  canCreate: boolean;
  canUpdate: boolean;
}

/** The employee's clearance and what the caller may do with it. */
export async function clearanceOf(emp: string): Promise<ClearanceState> {
  const json = await firstRecord("exit_clearance", emp);
  const row = json.data?.[0];
  return {
    id: row?.id ?? null,
    generated: row?.IS_GENERATED === "Yes",
    canCreate: !!json.permissions?.create,
    canUpdate: !!json.permissions?.update,
  };
}

/** Downloads one of the clearance's PDFs; throws the API's message. */
export async function downloadExitDocument(clearanceId: number, document: ExitDocument): Promise<void> {
  const res = await authFetch(`${DOCUMENTS_API}/${clearanceId}/${document}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message ?? "Could not create the document.");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `${document}.pdf`;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(window.document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** CI generateExitForm: marks the clearance generated (admins); returns the API's message. */
export async function generateExitForm(clearanceId: number): Promise<string> {
  const res = await authFetch(`${DOCUMENTS_API}/${clearanceId}/exit-form`, { method: "POST" });
  const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not generate the exit form.");
  return json.message ?? "Exit form generated.";
}
