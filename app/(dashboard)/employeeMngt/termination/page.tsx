import TerminationList from "./TerminationList";

/** CI employeeMngt/termination[/index/{EMP_ID}] — Employee Termination (?emp= one employee). Add / edit: the generic hub pages. */
export default async function TerminationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <TerminationList emp={typeof emp === "string" ? emp : undefined} />;
}
