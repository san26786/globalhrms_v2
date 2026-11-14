import InvestmentDetailsForm from "../InvestmentDetailsForm";

/** CI employeeMngt/emp_investments/newEmpInvestments[/{EMP_ID}] — add Investment Details (?emp= preselects the employee). */
export default async function InvestmentDetailsAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <InvestmentDetailsForm mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
