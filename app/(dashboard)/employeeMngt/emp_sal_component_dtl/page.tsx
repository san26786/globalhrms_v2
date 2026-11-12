import SalaryComponentsList from "./SalaryComponentsList";

/** CI employeeMngt/emp_sal_component_dtl[/index/…] — Component Wise Salary Breakup (?emp= one employee). */
export default async function SalaryComponentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <SalaryComponentsList emp={typeof emp === "string" ? emp : undefined} />;
}
