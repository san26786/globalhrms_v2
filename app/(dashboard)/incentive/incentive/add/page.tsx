import HubForm from "../../../employeeMngt/_hub/HubForm";

/** CI incentive/incentive/newincentivedetail — add an incentive or arrear (?emp= preselects the employee). */
export default async function IncentiveAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubForm screen="incentive" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
