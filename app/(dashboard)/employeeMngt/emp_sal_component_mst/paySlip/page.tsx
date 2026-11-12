import MyPayslipsList from "./MyPayslipsList";

/** CI employeeMngt/emp_sal_component_mst/paySlip — My Payslips (?emp= one employee). */
export default async function MyPayslipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <MyPayslipsList emp={typeof emp === "string" ? emp : undefined} />;
}
