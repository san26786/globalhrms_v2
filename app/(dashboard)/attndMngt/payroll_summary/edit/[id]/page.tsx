import HubForm from "../../../../employeeMngt/_hub/HubForm";

/** CI attndMngt/payroll_summary/editPayrollSummary/{id} — edit a month's attendance summary. */
export default async function PayrollSummaryEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return <HubForm screen="payroll_summary" mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
