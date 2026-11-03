"use client";

import { useMemo } from "react";

import type { BulkAction, RowAction } from "@/components/DataTable/types";
import type { ListAction } from "@/components/listview/ListViewShell";
import ResourceListPage, { type ResourceListColumn } from "@/components/resource/ResourceListPage";
import { HUB_DEFS } from "@/lib/employeeMngt/hub/hubDefs";
import { HUB_SCREENS, hubBase, type HubScreenKey } from "@/lib/employeeMngt/hub/hubTypes";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";

/**
 * CI employeeMngt/<screen>::index() (listview_v) for the Employee Hub record screens: the records of
 * the employees the caller may see, with the columns of the screen's CI view (labels and visibility from
 * its Form Settings). `emp` narrows the list to one employee (CI's employee tab, index/{EMP_ID}).
 * Rules and scoping: lib/employeeMngt/hub.
 */
export type HubRow = Record<string, unknown> & { id: number };
type Row = HubRow;
type ListContext = { refresh: () => void; permissions: { create: boolean; update: boolean; delete: boolean } };

/** CI listview showed Y-m-d values as dd.mm.yyyy. */
const ddmmyyyy = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join(".") : String(v ?? ""));
const yesNo = (v: unknown) => (["1", "y", "yes", "true"].includes(String(v ?? "").toLowerCase()) ? "Yes" : "No");

/** `listActions` / `bulkActions` / `rowActions`: a screen's own header buttons, actions on the selected rows and per-row menu items. */
export default function HubList({
  screen,
  emp,
  listActions,
  bulkActions,
  rowActions,
}: {
  screen: HubScreenKey;
  emp?: string;
  listActions?: (ctx: ListContext) => ListAction[];
  bulkActions?: (ctx: ListContext) => BulkAction<Row>[];
  rowActions?: RowAction<Row>[];
}) {
  const info = HUB_SCREENS[screen];
  const defs = HUB_DEFS[screen];
  const session = useCurrentSession();
  const base = hubBase(screen);

  const columns = useMemo(() => {
    const list: ResourceListColumn<Row>[] = defs.columns.map((c) => ({
      key: c.key,
      header: c.header,
      attribute: c.attribute ?? c.key,
      sortKey: c.sortable ? c.key : undefined,
      cell: c.format === "date" ? (r: Row) => ddmmyyyy(r[c.key]) : c.format === "yesno" ? (r: Row) => yesNo(r[c.key]) : undefined,
    }));
    if (session?.userLevel === 2 && !defs.columns.some((c) => c.key === "OA_BRAND_CD")) {
      list.push({ key: "OA_BRAND_CD", header: "Brand", attribute: "OA_BRAND_CD", sortKey: "OA_BRAND_CD" });
    }
    return list;
  }, [defs.columns, session?.userLevel]);

  const params = useMemo(() => (emp ? { emp } : undefined), [emp]);
  // A worklist opens the owning screen's form and comes back here afterwards.
  const editLink = (id: number) => {
    const query = new URLSearchParams({ ...(emp ? { emp } : {}), ...(defs.editsWith ? { back: emp ? `${base}?emp=${emp}` : base } : {}) }).toString();
    return `${defs.editsWith ? hubBase(defs.editsWith) : base}/edit/${id}${query ? `?${query}` : ""}`;
  };

  return (
    <ResourceListPage<Row>
      title={info.title}
      entity={screen}
      objectName={info.objectName}
      apiPath={`/api/employeeMngt/${screen}`}
      basePath={base}
      params={params}
      columns={columns}
      getId={(row) => row.id}
      searchPlaceholder="Search employee code, name…"
      addHref={emp ? `${base}/add?emp=${emp}` : `${base}/add`}
      editHref={(row) => editLink(row.id)}
      canDeleteRow={defs.canDeleteRow}
      listActions={listActions}
      extraBulkActions={bulkActions}
      extraRowActions={rowActions}
    />
  );
}
