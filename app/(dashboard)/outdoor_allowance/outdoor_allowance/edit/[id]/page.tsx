import HubForm from "../../../../employeeMngt/_hub/HubForm";

/** CI outdoor_allowance/outdoor_allowance/editoutdoor_allowance/{id} — edit an outdoor allowance period. */
export default async function OutdoorAllowanceEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return <HubForm screen="outdoor_allowance" mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
