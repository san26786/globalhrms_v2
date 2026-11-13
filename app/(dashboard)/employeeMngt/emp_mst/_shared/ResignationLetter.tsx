"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI emp_mst "Send Resignation Letter" (a normal user's own Personal form): modal "Resignation Letter" with a required
 * Reason, Close / Save. Saved as the user's pending resignation (POST /api/employeeMngt/termination/resign, the same as
 * Employee Termination's button — HR accepts or rejects it there). CI only e-mailed the letter, partly to a fixed address.
 */
export default function ResignationLetter() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!reason.trim()) {
      toast.error("The Reason Field is required");
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch("/api/employeeMngt/termination/resign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "The resignation could not be sent.");
      toast.success(json.message ?? "Resignation sent.");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The resignation could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Send Resignation Letter
        </Button>
      </div>
      {open ? (
        <Dialog open onOpenChange={(v) => !v && !busy && setOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Resignation Letter</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="resignReason">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea id="resignReason" rows={6} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button disabled={busy} onClick={save}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
