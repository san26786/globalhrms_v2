"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI systmMngt/emp_monthly_payment_details::index() ("Emp Monthly Salary"): per employee and month,
 * the generated payment totals (read-only; CI's "Sync Module" payslip button and row actions did not
 * work and are not ported). List: listDefinitions 'emp_monthly_payment_details'.
 */
export default function EmpMonthlyPaymentDetailsPage() {
  return <EntityListView list="emp_monthly_payment_details" />;
}
