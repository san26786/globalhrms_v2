"use client";

import { useMemo } from "react";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import { QUARTERS_API, QUARTERS_BASE } from "../form16Client";

/**
 * CI form16/form16_quarters::index() (listview_v over form16_quarters_vw): the quarters of the Form 16s the caller may
 * see — columns of the quarters header scripts (243 / 295), CI's "Add New Form-16 Quarters", row Edit / Delete.
 * Rules: lib/payroll/form16/quarters.ts. Addition: the employee's code and name (CI showed only the Form16 Id).
 */
type Row = Record<string, unknown> & { id: number };

/** CI listview showed Y-m-d values as dd.mm.yyyy. */
const ddmmyyyy = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join(".") : String(v ?? ""));

export default function QuarterList({ form16 }: { form16?: string }) {
  const session = useCurrentSession();
  const columns = useMemo(() => {
    const list: ResourceListColumn<Row>[] = [
      { key: "FORM16_ID", header: "Form16 Id", attribute: "FORM16_ID", sortKey: "FORM16_ID" },
      { key: "EMP_NBR", header: "Employee Code", sortKey: "EMP_NBR" },
      { key: "EMP_FULL_NAME", header: "Employee Name", sortKey: "EMP_FULL_NAME" },
      { key: "PERIOD_NM", header: "Period", attribute: "PERIOD_NM", sortKey: "PERIOD_NM" },
      { key: "QUARTERS_NM", header: "Quarters", attribute: "QUARTERS_NM", sortKey: "QUARTERS_NM" },
      { key: "RECEIPT_NO", header: "Receipt No", attribute: "RECEIPT_NO", sortKey: "RECEIPT_NO" },
      { key: "AMOUNT", header: "Amount", attribute: "AMOUNT", sortKey: "AMOUNT" },
      { key: "AMOUNT_TAX", header: "Amount Tax", attribute: "AMOUNT_TAX", sortKey: "AMOUNT_TAX" },
      { key: "BSR_CODE", header: "BSR Code", attribute: "BSR_CODE", sortKey: "BSR_CODE" },
      { key: "TAX_DATE", header: "Tax Date", attribute: "TAX_DATE", sortKey: "TAX_DATE", cell: (r) => ddmmyyyy(r.TAX_DATE) },
      { key: "CHALLAN_SL_NO", header: "Challan Sl No", attribute: "CHALLAN_SL_NO", sortKey: "CHALLAN_SL_NO" },
      { key: "OLTAS_STATUS_NM", header: "Oltas Status", attribute: "OLTAS_STATUS_NM", sortKey: "OLTAS_STATUS_NM" },
    ];
    if (session?.userLevel === 2) list.push({ key: "OA_BRAND_CD", header: "Brand", sortKey: "OA_BRAND_CD" });
    return list;
  }, [session?.userLevel]);

  return (
    <ResourceListPage<Row>
      title="Form-16 Quarters"
      entity="form16-quarters"
      objectName="form16_quarters_vw"
      apiPath={QUARTERS_API}
      basePath={QUARTERS_BASE}
      params={form16 ? { form16 } : undefined}
      columns={columns}
      getId={(row) => row.id}
      searchPlaceholder="Search employee, quarter, receipt no…"
      addHref={form16 ? `${QUARTERS_BASE}/add?form16=${encodeURIComponent(form16)}` : `${QUARTERS_BASE}/add`}
      editHref={(row) => `${QUARTERS_BASE}/edit/${row.id}?from=list`}
      viewWhenReadOnly
      columnSearch
    />
  );
}
