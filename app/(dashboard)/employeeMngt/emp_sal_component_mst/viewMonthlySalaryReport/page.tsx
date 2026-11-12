import SalaryReportList from "./SalaryReportList";

/** CI employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport — Salary Report (?emp= one employee). */
export default async function SalaryReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <SalaryReportList emp={typeof emp === "string" ? emp : undefined} />;
}
