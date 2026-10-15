"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import EntityListView, { type ListContext } from "@/components/listview/EntityListView";
import type { ListAction } from "@/components/listview/ListViewShell";
import type { GenerateResult } from "@/lib/systmMngt/employeePayments";
import { runAction, useInit } from "../_shared/useInit";

/**
 * CI systmMngt/employee_payment_details::index() ("Payroll Processing"): the payment rows, Edit
 * (Additional Comments) / Delete per row, and for admins "Generate Salary Details" (the current month).
 * List: listDefinitions 'employee_payment_details'; rules: lib/systmMngt/employeePayments.
 */
const GENERATE = "/api/systmMngt/employee_payment_details/generate";

export default function PaymentDetailsList({ empId }: { empId: string }) {
  const { data } = useInit<{ canGenerate: boolean }>(GENERATE);
  const [busy, setBusy] = useState(false);
  const query = useMemo(() => (empId ? { empId } : undefined), [empId]);

  const listActions = ({ refresh }: ListContext): ListAction[] =>
    data?.canGenerate
      ? [
          {
            key: "generate",
            title: "Generate Salary Details",
            icon: Upload,
            disabled: busy,
            onClick: async () => {
              setBusy(true);
              const result = await runAction<GenerateResult>(GENERATE, {
                method: "POST",
                confirm: "Generate this month's salary details for every employee of the brand? Existing rows of this month are replaced.",
              });
              setBusy(false);
              if (result?.skippedNoComponents) toast.warning(result.message);
              else if (result) toast.info(`${result.rows} payment row(s) for ${result.employees} employee(s).`);
              if (result) refresh();
            },
          },
        ]
      : [];

  return <EntityListView list="employee_payment_details" query={query} listActions={listActions} />;
}
