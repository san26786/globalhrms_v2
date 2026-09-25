"use client";

import { authFetch } from "@/lib/auth/authFetch";

/**
 * Downloads a CSV produced by an API route (CI force_download). Error responses use the standard
 * JSON envelope; their message is thrown so the page can show it.
 */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await authFetch(url);
  if (!res.ok) {
    let message = "Download failed.";
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

/** JSON call returning the envelope's data or throwing its message. */
export async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("Unexpected server response.");
  }
  if (!json.success) {
    const fieldMessage = json.errors ? Object.values(json.errors).flat()[0] : undefined;
    throw new Error(fieldMessage ?? json.message ?? "Request failed.");
  }
  return json.data as T;
}
