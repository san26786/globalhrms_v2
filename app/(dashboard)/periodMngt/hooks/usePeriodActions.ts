import { useCallback, useState } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/authFetch";
import { SETTINGS_VERIFY_HREF } from "@/lib/periodMngt/period.registry";
import type { PeriodActionResult } from "@/lib/periodMngt/period.types";

export type ActionName = "verify" | "lock" | "unlock" | "close" | "generate" | "sync";

function showMessages({ messages }: PeriodActionResult) {
  if (messages.success) toast.success(messages.success);
  if (messages.warning) toast.warning(messages.warning);
  if (messages.danger) toast.error(messages.danger);
}

export function usePeriodActions() {
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: ActionName, ids: unknown[], refresh: () => void) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/periodMngt/period_mst/actions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success || !json.data) {
        const message = json?.message ?? "The action failed.";
        toast.error(
          message,
          json?.code === "PERIOD_SETTINGS_NOT_VERIFIED"
            ? { action: { label: "Click here to verify", onClick: () => window.open(SETTINGS_VERIFY_HREF, "_blank") } }
            : undefined,
        );
        return;
      }
      showMessages(json.data);
      refresh();
    } catch {
      toast.error("The action failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, run };
}