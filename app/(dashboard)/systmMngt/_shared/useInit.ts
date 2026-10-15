"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/authFetch";

/** Loads a screen's init payload (CI initForm data) — `{ data, error, reload }`. */
export function useInit<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    authFetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: T } | null;
        if (!res.ok || !json?.success || json.data === undefined) throw new Error(json?.message ?? `Failed to load (${res.status}).`);
        if (!cancelled) {
          setData(json.data);
          setError(null);
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load."));
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}

/**
 * Saves a form (JSON or multipart). Success → toast + `{ ok: true }`; failure → toast + the API's
 * field errors (first message per field) for the form to show.
 */
export async function saveForm(
  url: string,
  method: "POST" | "PUT",
  body: unknown | FormData,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  try {
    const isForm = body instanceof FormData;
    const res = await authFetch(url, {
      method,
      ...(isForm ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string; errors?: Record<string, string[]> }
      | null;
    if (!res.ok || !json?.success) {
      toast.error(json?.message ?? "Save failed.");
      return { ok: false, errors: Object.fromEntries(Object.entries(json?.errors ?? {}).map(([k, v]) => [k, v[0]])) };
    }
    toast.success(json.message ?? "Saved.");
    return { ok: true };
  } catch {
    toast.error("Save failed.");
    return { ok: false, errors: {} };
  }
}

/** POST / PUT / DELETE an action endpoint; toasts its message. Returns the response data or null on failure. */
export async function runAction<T = unknown>(
  url: string,
  init: { method: "POST" | "PUT" | "DELETE"; body?: unknown; confirm?: string } = { method: "POST" },
): Promise<T | null> {
  if (init.confirm && !window.confirm(init.confirm)) return null;
  try {
    const res = await authFetch(url, {
      method: init.method,
      ...(init.body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : {}),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !json?.success) throw new Error(json?.message ?? "The action failed.");
    toast.success(json.message ?? "Done.");
    return (json.data ?? null) as T | null;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "The action failed.");
    return null;
  }
}
