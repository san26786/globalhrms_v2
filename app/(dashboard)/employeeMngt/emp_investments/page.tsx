import HubList from "../_hub/HubList";

/**
 * CI employeeMngt/emp_investments[/index/{EMP_ID}] — the Investment Details list (?emp= one employee). The same
 * HubList the generic [screen] page renders; this folder exists for the add / edit pages with "Save And Next".
 */
export default async function InvestmentDetailsListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <HubList screen="emp_investments" emp={typeof emp === "string" ? emp : undefined} />;
}
