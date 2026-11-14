"use client";

import { useEffect, useState } from "react";

import FormChildTable from "@/components/resource/FormChildTable";
import { authFetch } from "@/lib/auth/authFetch";
import type { FormTable } from "@/lib/form-init/formExtras";
import { QUARTERS_API, QUARTERS_BASE } from "./form16Client";

/**
 * CI form16/form16 edit form's child table (tableHeader / tableBody of form16_quarters_m::getformQuarters): the Form
 * 16's quarters — Quarter, Receipt No, Amount Paid, Amount Tax, BSR Code, Tax Date, Challan No, OLTAS Status — with
 * "Add Items" (a new quarter for this Form 16) and per-row Edit / Delete, each shown only with the menu's grant.
 * Rules: lib/payroll/form16/quarters.ts. Behaviour change: deleting a row stays on this Form 16 (CI went to the
 * quarters list).
 */
const COLUMNS = [
  { name: "QUARTERS_NM", label: "Quarter" },
  { name: "RECEIPT_NO", label: "Receipt No" },
  { name: "AMOUNT", label: "Amount Paid" },
  { name: "AMOUNT_TAX", label: "Amount Tax" },
  { name: "BSR_CODE", label: "BSR Code" },
  { name: "TAX_DATE", label: "Tax Date" },
  { name: "CHALLAN_SL_NO", label: "Challan No" },
  { name: "OLTAS_STATUS_NM", label: "OLTAS Status" },
];

type ListJson = {
  success?: boolean;
  message?: string;
  data?: Array<Record<string, unknown>>;
  permissions?: { create?: boolean; update?: boolean; delete?: boolean };
};

export default function Form16Quarters({ id }: { id: string }) {
  const [table, setTable] = useState<FormTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${QUARTERS_API}?${new URLSearchParams({ form16: id, limit: "100" })}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as ListJson | null;
        if (!res.ok || !json?.success) throw new Error(json?.message ?? "Could not load the quarters.");
        if (cancelled) return;
        const can = json.permissions ?? {};
        setTable({
          key: "form16_quarters",
          title: "Quarters",
          columns: COLUMNS,
          rows: json.data ?? [],
          rowKey: "id",
          addHref: can.create ? `${QUARTERS_BASE}/add?form16=${encodeURIComponent(id)}` : null,
          addLabel: "Add Items",
          editHref: can.update ? `${QUARTERS_BASE}/edit` : null,
          deleteApi: can.delete ? QUARTERS_API : null,
          emptyText: "No quarters yet.",
        });
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the quarters."));
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  if (error) return <p className="px-4 pb-6 text-sm text-red-500">{error}</p>;
  if (!table) return null;
  return (
    <div className="px-4 pb-6">
      <FormChildTable table={table} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
