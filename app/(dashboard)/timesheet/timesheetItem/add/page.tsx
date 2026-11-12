import TimesheetItemFormPage from "../timesheetItemForm";

/** CI timesheet/timesheetItem/newTmshtItem/{tsId} → /timesheet/timesheetItem/add?tsId= */
export default async function AddTimesheetItemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tsId } = await searchParams;
  return <TimesheetItemFormPage mode="add" tsId={typeof tsId === "string" && /^\d+$/.test(tsId) ? tsId : undefined} />;
}
