import IncentiveList from "./IncentiveList";

/** CI incentive/incentive[/index/{status}/{EMP_ID}/{type}] — Incentive (?emp= one employee). */
export default async function IncentivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <IncentiveList emp={typeof emp === "string" ? emp : undefined} />;
}
