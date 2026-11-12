import SalaryBreakupList from "./SalaryBreakupList";

/** CI employeeMngt/emp_sal_component_dtl/SalaryBreakUp — Salary Breakup (?emp= one employee). */
export default async function SalaryBreakupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <SalaryBreakupList emp={typeof emp === "string" ? emp : undefined} />;
}
