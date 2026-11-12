import FyMonthlyReport from "../_reports/FyMonthlyReport";

/** CI employeeMngt/emp_sal_component_dtl/MonthlyNetReport[/{emp}/{fy}] — Monthly Net Report (?emp=&fy=; 0 = not given). */
export default async function MonthlyNetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp, fy } = await searchParams;
  return <FyMonthlyReport kind="net" title="Monthly Net Report" emp={typeof emp === "string" ? emp : undefined} fy={typeof fy === "string" ? fy : undefined} />;
}
