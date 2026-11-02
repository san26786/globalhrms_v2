import HubForm from "../../../employeeMngt/_hub/HubForm";

/** CI job/job_mst/addJobMst[/{EMP_ID}] — add a job record (?emp= preselects the employee). */
export default async function JobAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubForm screen="job_mst" mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
