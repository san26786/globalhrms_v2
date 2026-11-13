import ProbationList from "./ProbationList";

/** CI job/job_mst/probation — Confirmation Pending: employees still on probation (admins: row Delete). */
export default async function ProbationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <ProbationList emp={typeof emp === "string" ? emp : undefined} />;
}
