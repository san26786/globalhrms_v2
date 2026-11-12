import TimesheetItemFormPage from "../../timesheetItemForm";

/** CI timesheet/timesheetItem/editTmshtItem/{id}. */
export default async function EditTimesheetItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TimesheetItemFormPage mode="edit" id={id} />;
}
