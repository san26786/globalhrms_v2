import HubList from "../../employeeMngt/_hub/HubList";

/** CI advance_salary/advance_salary — Advance Salary (?emp= one employee). */
export default async function AdvanceSalaryListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubList screen="advance_salary" emp={typeof emp === "string" ? emp : undefined} />;
}
