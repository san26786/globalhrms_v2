import TimesheetForm from "../../../timesheetForm";

/** CI timesheet/timesheet/editTimesheet/{id}/{status}/TEAM. */
export default async function EditTeamTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TimesheetForm mode="edit" id={id} team />;
}
