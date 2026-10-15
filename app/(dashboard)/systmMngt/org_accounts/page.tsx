"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
import type { ListAction } from "@/components/listview/ListViewShell";
import { runAction, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/org_accounts::index() ("Organisation"): superadmin — every organisation with Activate /
 * Deactivate Account for the selected rows; organisation admin — their organisation. Row edit / delete.
 * List: listDefinitions 'org_accounts'; rules: lib/systmMngt/orgAccounts.
 */
const STATUS = "/api/systmMngt/org_accounts/status";
type Row = Record<string, unknown>;

export default function OrgAccountsPage() {
  const { data } = useInit<{ canManage: boolean }>(STATUS);

  const change = async (status: "OASA" | "OASI", selected: Row[], refresh: () => void) => {
    if (!selected.length) return toast.error("Please select an organisation.");
    const done = await runAction(STATUS, { method: "POST", body: { status, ids: selected.map((r) => r.OA_ID) } });
    if (done) refresh();
  };

  const listActions = ({ selected, refresh }: ListContext): ListAction[] =>
    data?.canManage
      ? [
          { key: "activate", title: "Activate Account", icon: ThumbsUp, onClick: () => void change("OASA", selected, refresh) },
          { key: "deactivate", title: "Deactivate Account", icon: ThumbsDown, onClick: () => void change("OASI", selected, refresh) },
        ]
      : [];

  return <EntityListView list="org_accounts" listActions={listActions} />;
}
