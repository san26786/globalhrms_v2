import ExitClearanceList from "./_exit/ExitClearanceList";

/** CI department_activity/department_head_supervisor[/index/{EMP_ID}] — Exit and Clearance Formality (?emp= one employee). */
export default async function ExitClearancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <ExitClearanceList emp={typeof emp === "string" ? emp : undefined} />;
}
