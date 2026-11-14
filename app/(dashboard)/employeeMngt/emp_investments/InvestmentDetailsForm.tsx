"use client";

import { useRouter } from "next/navigation";

import HubForm from "../_hub/HubForm";

/**
 * CI employeeMngt/emp_investments::initForm (add and edit): the Investment Details form with CI's form button
 * "Save And Next" — it saves the record and opens its Investment Declaration page (CI insert / update with `next`:
 * redirect to emp_investment_declarations/index/{id}). Save alone returns to the list, as CI; no "Save And Add" (CI).
 */
export const declarationHref = (id: number | string) => `/employeeMngt/emp_investments/declarations?investment=${encodeURIComponent(String(id))}`;

export default function InvestmentDetailsForm({ mode, id, emp, back }: { mode: "add" | "edit"; id?: string; emp?: string; back?: string }) {
  const router = useRouter();
  return (
    <HubForm
      screen="emp_investments"
      mode={mode}
      id={id}
      emp={emp}
      back={back}
      // CI: saveAndAddButton = false on this form.
      saveAndAdd={false}
      extraSaves={[
        {
          key: "next",
          label: "Save And Next",
          after: (_employee, recordId) => {
            if (recordId) router.push(declarationHref(recordId));
          },
        },
      ]}
    />
  );
}
