import { ExitStepForm } from "../../_exit/ExitSteps";

/** CI department_activity/department_head_supervisor/editDepartmentHeadSupervisor/{id}[/{EMP_ID}]. */
export default async function ExitClearanceEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return <ExitStepForm step="exit_clearance" mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
