import HubList from "../../employeeMngt/_hub/HubList";

/** CI outdoor_allowance/outdoor_allowance — Outdoor Allowance Details (?emp= one employee). */
export default async function OutdoorAllowanceListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubList screen="outdoor_allowance" emp={typeof emp === "string" ? emp : undefined} />;
}
