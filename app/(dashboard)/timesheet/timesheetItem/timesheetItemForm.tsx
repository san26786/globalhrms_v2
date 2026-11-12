"use client";

import { useRouter } from "next/navigation";

import ResourceFormPage from "@/components/resource/ResourceFormPage";

/**
 * CI timesheetItem::newTmshtItem / ::editTmshtItem and new_timesheet_item (formview_v). Fields,
 * defaults (continuing after the timesheet's last item) and save action come from
 * lib/timesheet/timesheetItem.form.ts. After saving, the item's timesheet opens (CI editTimesheet/{tsId}).
 *  - tsId: add to that timesheet (from the timesheet form's "Add Items");
 *  - byDate: New Timesheet Item — the date's timesheet is found or created;
 *  - neither: choose one of your editable timesheets.
 */
export default function TimesheetItemFormPage({
  mode,
  id,
  tsId,
  date,
  byDate = false,
}: {
  mode: "add" | "edit";
  id?: string;
  tsId?: string;
  date?: string;
  byDate?: boolean;
}) {
  const router = useRouter();
  const qs = new URLSearchParams();
  if (tsId) qs.set("tsId", tsId);
  if (date) qs.set("date", date);
  if (byDate) qs.set("byDate", "1");
  const back = tsId ? `/timesheet/timesheet/edit/${tsId}` : byDate ? "/timesheet/timesheet/timesheetBlock" : "/timesheet/timesheetItem";
  return (
    <ResourceFormPage
      breadcrumb={["Timesheet", byDate ? "New Timesheet Item" : "Timesheet Item"]}
      mode={mode}
      id={id}
      apiPath="/api/timesheet/timesheetItem"
      basePath={back}
      initUrl={`/api/timesheet/timesheetItem/init${qs.size ? `?${qs}` : ""}`}
      allowSaveAndAdd={!byDate}
      onSaved={(data) => {
        const saved = (data as { tsId?: number } | null)?.tsId;
        router.push(saved ? `/timesheet/timesheet/edit/${saved}` : back);
      }}
    />
  );
}
