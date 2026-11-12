import HubForm from "../../../../employeeMngt/_hub/HubForm";
import RepaymentSchedule from "../../RepaymentSchedule";

/** CI advance_salary/advance_salary/editadvancesalarydetail/{id} — edit an advance and tick its instalments. */
export default async function AdvanceSalaryEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return (
    <>
      <HubForm screen="advance_salary" mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />
      <RepaymentSchedule id={id} />
    </>
  );
}
