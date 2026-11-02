import HubList from "../../../employeeMngt/_hub/HubList";

/** CI job/job_mst/probation — Confirmation Pending: employees still on probation. */
export default async function ProbationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubList screen="job_probation" emp={typeof emp === "string" ? emp : undefined} />;
}
