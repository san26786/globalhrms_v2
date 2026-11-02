import HubList from "../../employeeMngt/_hub/HubList";

/** CI job/job_mst[/index/{EMP_ID}] — Job Detail (?emp= one employee). */
export default async function JobListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubList screen="job_mst" emp={typeof emp === "string" ? emp : undefined} />;
}
