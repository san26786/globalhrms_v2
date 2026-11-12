import TimesheetList from "../timesheetList";

/** CI timesheet/timesheet/MyTeamTimesheet/{status}/{period} → /timesheet/timesheet/team?status=&period= */
export default async function TeamTimesheetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = (key: string) => {
    const v = sp[key];
    return typeof v === "string" && /^\d+$/.test(v) && v !== "0" ? v : "";
  };
  return <TimesheetList team status={id("status")} period={id("period")} />;
}
