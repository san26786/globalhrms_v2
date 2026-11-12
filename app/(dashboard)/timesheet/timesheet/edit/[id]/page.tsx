import TimesheetForm from "../../timesheetForm";

/** CI timesheet/timesheet/editTimesheet/{id}. */
export default async function EditTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TimesheetForm mode="edit" id={id} />;
}
