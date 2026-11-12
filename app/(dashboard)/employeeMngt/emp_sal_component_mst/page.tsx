import PayrollProcessingList from "./PayrollProcessingList";

/** CI employeeMngt/emp_sal_component_mst[/index/…] — Payroll Processing (admins; ?emp= one employee). */
export default async function PayrollProcessingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <PayrollProcessingList emp={typeof emp === "string" ? emp : undefined} />;
}
