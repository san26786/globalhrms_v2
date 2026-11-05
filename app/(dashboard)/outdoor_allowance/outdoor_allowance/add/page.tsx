import HubForm from "../../../employeeMngt/_hub/HubForm";

/** CI outdoor_allowance/outdoor_allowance/addoutdoor_allowance — add an outdoor allowance period (?emp= preselects the employee). */
export default async function OutdoorAllowanceAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubForm screen="outdoor_allowance" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
