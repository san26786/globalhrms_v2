import ResourceFormPage from "@/components/resource/ResourceFormPage";

/** CI timesheet/timesheet_emp/editTimesheetEmp/{id}: Is Manager and Manager (code / name read-only). */
export default async function EditTimesheetEmpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ResourceFormPage
      breadcrumb={["Timesheet", "Timesheet Employee"]}
      mode="edit"
      id={id}
      apiPath="/api/timesheet/timesheet_emp"
      basePath="/timesheet/timesheet_emp"
      initUrl="/api/timesheet/timesheet_emp/init"
    />
  );
}
