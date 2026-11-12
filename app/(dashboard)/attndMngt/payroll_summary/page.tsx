import PayrollSummaryList from "./PayrollSummaryList";

/** CI attndMngt/payroll_summary[/index/{month}] — Payroll Attendance Summary (?emp= one employee). */
export default async function PayrollSummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <PayrollSummaryList emp={typeof emp === "string" ? emp : undefined} />;
}
