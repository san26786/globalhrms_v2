import HubForm from "../../../employeeMngt/_hub/HubForm";

/** CI attndMngt/payroll_summary/addPayrollSummary — add a month's attendance summary (?emp= preselects the employee). */
export default async function PayrollSummaryAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubForm screen="payroll_summary" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
