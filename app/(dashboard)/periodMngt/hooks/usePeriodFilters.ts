import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth/authFetch";
import type { PeriodListFilters } from "@/lib/periodMngt/period.types";

export function usePeriodFilters() {
  const [filters, setFilters] = useState<PeriodListFilters | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/periodMngt/period_mst/filters", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? "Failed to load the filters.");
        if (!cancelled) setFilters(json.data);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load the filters.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return filters;
}