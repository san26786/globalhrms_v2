import PaymentDetailsList from "./PaymentDetailsList";

/** CI systmMngt/employee_payment_details/index/{empId} → /systmMngt/employee_payment_details?empId= */
export default async function EmployeePaymentDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const empId = typeof sp.empId === "string" && /^\d+$/.test(sp.empId) ? sp.empId : "";
  return <PaymentDetailsList empId={empId} />;
}
