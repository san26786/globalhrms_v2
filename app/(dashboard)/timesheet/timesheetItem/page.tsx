import TimesheetItemList from "./timesheetItemList";

/** CI timesheet/timesheetItem::index() ("Timesheet Item") → /timesheet/timesheetItem?period= */
export default async function TimesheetItemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { period } = await searchParams;
  return <TimesheetItemList period={typeof period === "string" && /^\d+$/.test(period) ? period : ""} />;
}
