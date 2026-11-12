import FyMonthlyReport from "../_reports/FyMonthlyReport";

/** CI employeeMngt/emp_sal_component_dtl/MonthlyGrossReport[/{emp}/{fy}] — Monthly Gross Report (?emp=&fy=; 0 = not given). */
export default async function MonthlyGrossPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp, fy } = await searchParams;
  return <FyMonthlyReport kind="gross" title="Monthly Gross Report" emp={typeof emp === "string" ? emp : undefined} fy={typeof fy === "string" ? fy : undefined} />;
}
