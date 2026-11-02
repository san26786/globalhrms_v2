import HubForm from "../../../../employeeMngt/_hub/HubForm";

/** CI job/job_mst/editJobMst/{id}[/{EMP_ID}[/PENDING]] — edit a job record (?back= the list to return to). */
export default async function JobEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp, back } = await searchParams;
  return (
    <HubForm
      screen="job_mst"
      mode="edit"
      id={id}
      emp={typeof emp === "string" ? emp : undefined}
      back={typeof back === "string" ? back : undefined}
    />
  );
}
