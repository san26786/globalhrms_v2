import FyMonthlyReport from "../_reports/FyMonthlyReport";

/** CI employeeMngt/emp_sal_component_dtl/professionalTax[/{emp}/{fy}] — Professional Tax (?emp=&fy=; 0 = not given). */
export default async function ProfessionalTaxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp, fy } = await searchParams;
  return <FyMonthlyReport kind="pt" title="Professional Tax" emp={typeof emp === "string" ? emp : undefined} fy={typeof fy === "string" ? fy : undefined} />;
}
