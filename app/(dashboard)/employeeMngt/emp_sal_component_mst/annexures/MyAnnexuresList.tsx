"use client";

import { useMemo, useState } from "react";

import { PlainSelect } from "@/(dashboard)/utilities/_components/UtilityPage";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList from "../../_hub/HubList";
import { STATUSES, documentActions } from "../_annexure/annexureActions";

/**
 * CI employeeMngt/emp_sal_component_mst/annexures (My Annexures) and emp_annexures/{EMP_ID}: the yearly annexures
 * the caller may see (a normal user: their own) and their PDFs. Admins filter by employment status (not on one
 * employee's tab). Rules: lib/employeeMngt/hub/screens/annexures.ts.
 */
export default function MyAnnexuresList({ emp }: { emp?: string }) {
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0 && !emp;
  const [status, setStatus] = useState("EMSC");
  const filters = useMemo(() => (admin ? { status } : undefined), [admin, status]);

  return (
    <HubList
      screen="my_annexures"
      emp={emp}
      filters={filters}
      toolbar={
        admin
          ? () => (
              <div className="grid grid-cols-1 gap-4 rounded-3xl border bg-white p-4 shadow-sm brand:border-slate-200 md:grid-cols-3 dark:border-white/10 dark:bg-[#111a2e]">
                <PlainSelect id="myAnnexStatus" label="Employment Status" value={status} onChange={setStatus} options={STATUSES} />
              </div>
            )
          : undefined
      }
      rowActions={documentActions}
    />
  );
}
