import EmployeeDetailsList from "./EmployeeDetailsList";

/** CI employeeMngt/emp_hrprocess — Employee Details (Payroll): each employee's current job and what payroll still misses (?emp= one employee). */
export default async function EmployeeDetailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <EmployeeDetailsList emp={typeof emp === "string" ? emp : undefined} />;
}
