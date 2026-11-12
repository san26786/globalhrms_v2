import HubForm from "../../../employeeMngt/_hub/HubForm";

/** CI advance_salary/advance_salary/newadvancesalarydetail — add an advance (?emp= preselects the employee). */
export default async function AdvanceSalaryAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubForm screen="advance_salary" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
