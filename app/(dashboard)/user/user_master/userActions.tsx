"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ThumbsDown, ThumbsUp, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/authFetch";
import { useUserAdminMeta } from "../_shared/formKit";

/** Per-user status change (CI single_user_change_status/{USA|USD}/{id}) — admins only. */
export async function changeUserStatus(action: "activate" | "deactivate" | "activate-suspended", ids: number[]) {
  const res = await authFetch("/api/user/user_master/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ids }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message ?? "Action failed.");
  return json.data as { count: number; message: string };
}

/**
 * Edit-screen toolbar: CI "Send Password Reset Mail" (next to the password box), Activate /
 * Deactivate buttons (admins) and the "User Role" tab.
 */
export default function UserActions({ id }: { id: string }) {
  const meta = useUserAdminMeta();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.success(await fn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const sendReset = () =>
    run(async () => {
      const res = await authFetch(`/api/user/user_master/${id}/send-reset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Could not send the password reset mail.");
      return `Password reset mail sent to ${json.data?.email ?? "the registered email"}.`;
    });

  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 pt-4">
      <Button asChild variant="outline" size="sm" className="rounded-full">
        <Link href={`/user/user_role?userId=${id}`}>
          <UserCog className="mr-1 h-4 w-4" /> User Role
        </Link>
      </Button>
      <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={sendReset}>
        <Mail className="mr-1 h-4 w-4" /> Send Password Reset Mail
      </Button>
      {meta?.canChangeStatus && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => run(async () => (await changeUserStatus("activate", [Number(id)])).message)}
          >
            <ThumbsUp className="mr-1 h-4 w-4" /> Activate User
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => run(async () => (await changeUserStatus("deactivate", [Number(id)])).message)}
          >
            <ThumbsDown className="mr-1 h-4 w-4" /> Deactivate User
          </Button>
        </>
      )}
    </div>
  );
}
