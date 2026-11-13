"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import ConfirmDelete from "@/components/Dialog/ConfirmDelete";
import { authFetch } from "@/lib/auth/authFetch";
import HubList, { type HubRow } from "../../../employeeMngt/_hub/HubList";

/**
 * CI job/job_mst/probation (Confirmation Pending): the probation worklist, plus CI's admin row Delete
 * (common_c/softDelete/job_mst/JOB_ID). The worklist never writes itself: Delete goes to Job Detail's
 * DELETE (/api/employeeMngt/job_mst/{id}), so Job Detail's grant, scope and soft delete apply, and is
 * offered only when that grant allows it (/api/job/job_mst/permissions).
 */
const JOB_API = "/api/employeeMngt/job_mst";

/** Hands the list's refresh to the page (the hub list gives it to its toolbar slot only); renders nothing. */
function KeepRefresh({ refresh, onReady }: { refresh: () => void; onReady: (refresh: () => void) => void }) {
  useEffect(() => onReady(refresh), [refresh, onReady]);
  return null;
}

export default function ProbationList({ emp }: { emp?: string }) {
  const [canDelete, setCanDelete] = useState(false);
  const [pending, setPending] = useState<HubRow | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshList = useRef<(() => void) | null>(null);
  const keepRefresh = useCallback((refresh: () => void) => {
    refreshList.current = refresh;
  }, []);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/job/job_mst/permissions", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => !cancelled && setCanDelete(!!json?.success && json.data?.delete === true))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await authFetch(`${JOB_API}/${pending.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Delete failed.");
      toast.success(json.message ?? "Record deleted.");
      setPending(null);
      refreshList.current?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <HubList
        screen="job_probation"
        emp={emp}
        rowActions={canDelete ? [{ label: "Delete", icon: Trash2, variant: "destructive", separator: true, onClick: (row) => setPending(row) }] : undefined}
        toolbar={({ refresh }) => <KeepRefresh refresh={refresh} onReady={keepRefresh} />}
      />
      <ConfirmDelete open={pending !== null} loading={busy} onClose={() => !busy && setPending(null)} onConfirm={remove} />
    </>
  );
}
