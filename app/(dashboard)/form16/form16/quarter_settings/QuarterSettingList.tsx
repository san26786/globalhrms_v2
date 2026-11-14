"use client";

import { useMemo } from "react";

import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";

/**
 * CI form16/form16_quarter_settings::index() (listview_v over form16_quarter_settings_vw): Financial Year, Quarter,
 * Start Date, End Date (the view's Form Settings can show the ids and owner columns), "Add New …", row Edit / Delete.
 * Rules: lib/payroll/form16/quarterSettings.ts.
 */
type Row = Record<string, unknown> & { id: number };

const API = "/api/form16/form16_quarter_settings";
const BASE = "/form16/form16/quarter_settings";
const ddmmyyyy = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join(".") : String(v ?? ""));

export default function QuarterSettingList() {
  const session = useCurrentSession();
  const columns = useMemo(() => {
    const list: ResourceListColumn<Row>[] = [
      { key: "FORM16_QUARTER_SETTINGS_ID", header: "Form16 Quarter Settings Id", attribute: "FORM16_QUARTER_SETTINGS_ID", sortKey: "FORM16_QUARTER_SETTINGS_ID" },
      { key: "FINANCIAL_YEAR_ID", header: "Financial Year Id", attribute: "FINANCIAL_YEAR_ID", sortKey: "FINANCIAL_YEAR_ID" },
      { key: "FINANCIAL_YEAR_NM", header: "Financial Year", attribute: "FINANCIAL_YEAR_NM", sortKey: "FINANCIAL_YEAR_NM" },
      { key: "QUARTER_ID", header: "Quarter Id", attribute: "QUARTER_ID", sortKey: "QUARTER_ID" },
      { key: "QUARTER_NM", header: "Quarter", attribute: "QUARTER_NM", sortKey: "QUARTER_NM" },
      { key: "START_DATE", header: "Start Date", attribute: "START_DATE", sortKey: "START_DATE", cell: (r) => ddmmyyyy(r.START_DATE) },
      { key: "END_DATE", header: "End Date", attribute: "END_DATE", sortKey: "END_DATE", cell: (r) => ddmmyyyy(r.END_DATE) },
      { key: "OA_ID", header: "Oa Id", attribute: "OA_ID", sortKey: "OA_ID" },
      { key: "USER_ID", header: "User Id", attribute: "USER_ID", sortKey: "USER_ID" },
    ];
    if (session?.userLevel === 2) list.push({ key: "OA_BRAND_CD", header: "Brand", sortKey: "OA_BRAND_CD" });
    return list;
  }, [session?.userLevel]);

  return (
    <ResourceListPage<Row>
      title="Form-16 Quarter Settings Detail"
      entity="form16-quarter-settings"
      objectName="form16_quarter_settings_vw"
      apiPath={API}
      basePath={BASE}
      columns={columns}
      getId={(row) => row.id}
      searchPlaceholder="Search financial year, quarter…"
      viewWhenReadOnly
      columnSearch
    />
  );
}
