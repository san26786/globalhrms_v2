import TimesheetBlock from "./timesheetBlock";

/**
 * CI timesheet/timesheet/timesheetBlock/{monthOffset}/{empId} ("Manage Timesheet" / "Submit for
 * Approval Timesheet") → /timesheet/timesheet/timesheetBlock?month=YYYY-MM&empId=
 */
export default async function TimesheetBlockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "";
  const empId = typeof sp.empId === "string" && /^\d+$/.test(sp.empId) ? sp.empId : "";
  return <TimesheetBlock month={month} empId={empId} />;
}
