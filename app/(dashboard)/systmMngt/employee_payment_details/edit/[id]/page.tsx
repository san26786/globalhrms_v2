import PaymentCommentsForm from "../../PaymentCommentsForm";

/** CI systmMngt/employee_payment_details/editEmployeePayment/{id}. */
export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentCommentsForm id={id} />;
}
