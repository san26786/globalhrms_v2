"use client";

import { RefreshCw } from "lucide-react";

import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
import type { ListAction } from "@/components/listview/ListViewShell";
import { runAction, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/salary_component_settings::index() ("Salary Component"): list, Add New Salary
 * Component, and "Synced Salary Component" for brand admins. List: listDefinitions
 * 'salary_component_settings'; rules: lib/systmMngt/salaryComponentSettings.
 */
const SYNC = "/api/systmMngt/salary_component_settings/sync";

export default function SalaryComponentSettingsPage() {
  const { data } = useInit<{ canSync: boolean }>(SYNC);

  const listActions = ({ refresh }: ListContext): ListAction[] =>
    data?.canSync
      ? [
          {
            key: "sync",
            title: "Synced Salary Component",
            icon: RefreshCw,
            onClick: async () => {
              const ok = await runAction(SYNC, {
                method: "POST",
                confirm: "Replace this brand's salary components with the system template?",
              });
              if (ok) refresh();
            },
          },
        ]
      : [];

  return <EntityListView list="salary_component_settings" listActions={listActions} />;
}
