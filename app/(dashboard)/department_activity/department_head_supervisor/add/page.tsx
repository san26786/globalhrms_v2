import { ExitStepForm } from "../_exit/ExitSteps";

/** CI department_activity/department_head_supervisor/newDepartmentHeadSupervisor[/{EMP_ID}] — start an employee's exit clearance. */
export default async function ExitClearanceAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <ExitStepForm step="exit_clearance" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
