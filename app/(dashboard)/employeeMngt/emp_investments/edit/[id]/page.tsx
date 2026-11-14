import InvestmentDetailsForm from "../../InvestmentDetailsForm";

/** CI employeeMngt/emp_investments/editEmp_investments/{id}[/{EMP_ID}] — edit Investment Details. */
export default async function InvestmentDetailsEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp, back } = await searchParams;
  return <InvestmentDetailsForm mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} back={typeof back === "string" ? back : undefined} />;
}
