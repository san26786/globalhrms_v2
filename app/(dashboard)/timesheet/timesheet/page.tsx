import TimesheetList from "./timesheetList";

/**
 * CI timesheet/timesheet/index/{status}/{period} → /timesheet/timesheet?status=&period=
 * (old CI URLs are redirected here by proxy.ts through the route registry).
 * Buttons: listDefinitions 'timesheet' listActions.
 */
export default async function TimesheetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = (key: string) => {
    const v = sp[key];
    return typeof v === "string" && /^\d+$/.test(v) && v !== "0" ? v : "";
  };
  return <TimesheetList team={false} status={id("status")} period={id("period")} />;
}
