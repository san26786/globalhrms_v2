// lib/utils/browser.ts
//
// CLIENT-ONLY. Uses `window`/`document`/`navigator` and will throw or no-op
// if imported into server-side code. Import via `@/lib/utils/client` (or
// this file directly) — never from the universal `@/lib/utils` barrel.
//
// Plain functions only — no React hooks or component logic (that belongs in
// a hooks file, not lib/utils).

/** Returns true when running in a browser environment. */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Copies text to the clipboard, using the async Clipboard API when
 * available and falling back to a hidden-textarea + execCommand approach
 * for older browsers or insecure contexts.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!isBrowser()) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("navigator.clipboard not available");
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch {
      return false;
    }
  }
}

/** Triggers a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (!isBrowser()) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of raw text content under the given filename. */
export function downloadText(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}