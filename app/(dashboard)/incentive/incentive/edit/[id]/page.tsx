import HubForm from "../../../../employeeMngt/_hub/HubForm";

/** CI incentive/incentive/editincentivedetail/{id} — edit an incentive or arrear. */
export default async function IncentiveEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return <HubForm screen="incentive" mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
