import { authFetch } from "@/lib/auth/authFetch";

/**
 * Client helpers of the Form 16 pages: the certificate PDF (API /api/form16/form16/{id}/document, rules in
 * lib/payroll/form16/document) — "preview" opens it in a new tab (downloads it when the browser blocks the tab),
 * "generate" downloads it (CI generateForm16 wrote it to a server folder).
 */
export const FORM16_LIST = "/form16/form16";
export const QUARTERS_BASE = "/form16/form16/quarters";
export const QUARTERS_API = "/api/form16/form16_quarters";

export const documentUrl = (id: number | string, periods: { period?: string; fy?: string } = {}, download = false) => {
  const query = new URLSearchParams({
    ...(periods.period ? { period: periods.period } : {}),
    ...(periods.fy ? { fy: periods.fy } : {}),
    ...(download ? { download: "1" } : {}),
  }).toString();
  return `/api/form16/form16/${encodeURIComponent(String(id))}/document${query ? `?${query}` : ""}`;
};

/** Fetches the PDF; throws the API's message. */
async function fetchPdf(url: string): Promise<{ blob: Blob; name: string }> {
  const res = await authFetch(url);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message ?? "Could not create the Form 16.");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "Form16.pdf";
  return { blob: await res.blob(), name };
}

function save(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = Object.assign(window.document.createElement("a"), { href, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** CI previewForm16: the PDF in a new tab. */
export async function previewForm16(id: number | string, periods: { period?: string; fy?: string }): Promise<void> {
  const { blob, name } = await fetchPdf(documentUrl(id, periods));
  const href = URL.createObjectURL(blob);
  // No "noopener" feature: with it window.open returns null, which would read as "blocked".
  const tab = window.open(href, "_blank");
  if (tab) tab.opener = null;
  else save(blob, name);
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}

/** CI generateForm16: the PDF as a file. */
export async function generateForm16(id: number | string, periods: { period?: string; fy?: string }): Promise<void> {
  const { blob, name } = await fetchPdf(documentUrl(id, periods, true));
  save(blob, name);
}
