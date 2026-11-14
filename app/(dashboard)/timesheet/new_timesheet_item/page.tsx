import TimesheetItemFormPage from "../timesheetItem/timesheetItemForm";

/**
 * CI timesheet/new_timesheet_item/index/{date} ("New Timesheet Item") → /timesheet/new_timesheet_item?date=
 * The item form by date: the day's timesheet is found or created when the item is saved.
 */
export default async function NewTimesheetItemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { date } = await searchParams;
  return <TimesheetItemFormPage mode="add" byDate date={typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined} />;
}
