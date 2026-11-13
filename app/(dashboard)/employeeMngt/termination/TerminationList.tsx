"use client";

import { useState } from "react";
import { Loader2, Mail, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../_hub/HubList";

/**
 * CI employeeMngt/termination list: the exit records, plus CI's toolbar — a normal user sends a
 * resignation letter (one pending record for HR); admins accept or reject the selected pending
 * resignations and bring the employees' statuses up to date with exits whose date has passed. The
 * resignation and the decisions are e-mailed (CI's mails); one that could not be sent shows as a warning.
 * Rules: lib/employeeMngt/termination.ts.
 */
const API = "/api/employeeMngt/termination";

type Pending =
  | { kind: "resign"; refresh: () => void }
  | { kind: "accept" | "reject"; ids: number[]; refresh: () => void }
  | { kind: "statuses"; refresh: () => void };

/** `warn`: the write succeeded but an e-mail could not be sent (the message says which). */
async function post(url: string, body?: unknown): Promise<{ message: string; warn: boolean }> {
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    data?: { mailProblems?: string[] };
  } | null;
  if (!res.ok || !json?.success) throw new Error(Object.values(json?.errors ?? {})[0]?.[0] ?? json?.message ?? "The request failed.");
  return { message: json.message ?? "Done.", warn: !!json.data?.mailProblems?.length };
}

const TEXT: Record<Exclude<Pending["kind"], "resign">, { title: string; description: (n: number) => string; button: string }> = {
  accept: {
    title: "Accept Resignation",
    description: (n) => `Accept ${n === 1 ? "this resignation" : `${n} resignations`}? The termination date is set to three months from today and the notice period starts.`,
    button: "Accept",
  },
  reject: {
    title: "Reject Resignation",
    description: (n) => `Reject ${n === 1 ? "this resignation" : `${n} resignations`}? The record becomes "Employment Retained" and the employee stays.`,
    button: "Reject",
  },
  statuses: {
    title: "Update Employee Statuses",
    description: () => "Set each employee's job and employee status from their latest exit record. Employees whose termination date has passed become Former and their login is deactivated.",
    button: "Update",
  },
};

export default function TerminationList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => !busy && setPending(null);

  const run = async () => {
    if (!pending) return;
    if (pending.kind === "resign" && !reason.trim()) return toast.error("The Reason field is required.");
    setBusy(true);
    try {
      const { message, warn } =
        pending.kind === "resign"
          ? await post(`${API}/resign`, { reason })
          : pending.kind === "statuses"
            ? await post(`${API}/recompute`)
            : await post(`${API}/resignation-status`, { ids: pending.ids, action: pending.kind });
      if (warn) toast.warning(message);
      else toast.success(message);
      setPending(null);
      setReason("");
      pending.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  };

  const decide = (kind: "accept" | "reject", rows: HubRow[], refresh: () => void) => {
    if (rows.some((r) => r.RESIGNATION_STATUS !== "Pending")) return toast.error("Only pending resignations can be accepted or rejected.");
    setPending({ kind, ids: rows.map((r) => r.id), refresh });
  };

  return (
    <>
      <HubList
        screen="termination"
        emp={emp}
        listActions={({ refresh, permissions }) =>
          admin
            ? permissions.update
              ? [{ key: "statuses", title: "Update Employee Statuses", icon: RefreshCw, onClick: () => setPending({ kind: "statuses", refresh }) }]
              : []
            : [{ key: "resign", title: "Send Resignation Letter", icon: Mail, onClick: () => setPending({ kind: "resign", refresh }) }]
        }
        bulkActions={({ refresh, permissions }) =>
          admin && permissions.update
            ? [
                { label: "Accept Resignation", icon: ThumbsUp, onClick: (rows) => decide("accept", rows, refresh) },
                { label: "Reject Resignation", icon: ThumbsDown, onClick: (rows) => decide("reject", rows, refresh) },
              ]
            : []
        }
      />

      <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-lg">
          {pending?.kind === "resign" ? (
            <>
              <DialogHeader>
                <DialogTitle>Resignation Letter</DialogTitle>
                <DialogDescription>Your resignation goes to HR, who accept or reject it here.</DialogDescription>
              </DialogHeader>
              <label className="text-sm font-medium" htmlFor="resignation-reason">
                Reason <span className="text-red-500">*</span>
              </label>
              <Textarea id="resignation-reason" className="w-full" rows={6} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          ) : pending ? (
            <DialogHeader>
              <DialogTitle>{TEXT[pending.kind].title}</DialogTitle>
              <DialogDescription>{TEXT[pending.kind].description("ids" in pending ? pending.ids.length : 0)}</DialogDescription>
            </DialogHeader>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={close}>
              Close
            </Button>
            <Button disabled={busy} onClick={run} variant={pending?.kind === "reject" ? "destructive" : "default"}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending?.kind === "resign" ? "Send" : pending ? TEXT[pending.kind].button : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
