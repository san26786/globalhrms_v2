"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI systmMngt/emp_yearly_payment_details::index() ("Emp Yearly Salary"): per employee and year, the
 * generated payment totals (read-only, as CI). List: listDefinitions 'emp_yearly_payment_details'.
 */
export default function EmpYearlyPaymentDetailsPage() {
  return <EntityListView list="emp_yearly_payment_details" />;
}
