import TimesheetEmpList from "./timesheetEmpList";

/** CI timesheet/timesheet_emp/index/{empStatus} → /timesheet/timesheet_emp?status= */
export default async function TimesheetEmpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && /^\d+$/.test(sp.status) ? sp.status : "";
  return <TimesheetEmpList status={status} />;
}
