import BrandPicker from "./BrandPicker";

/**
 * CI systmMngt/oa_brands/MyDashboard (?value=1) → /systmMngt/oa_brands/my_dashboard,
 * switchBrandForPartners/{oaId} → ?view=partner, switchBrandForAccountant/{oaId} → ?view=accountant.
 */
export default async function MyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view = sp.view === "partner" || sp.view === "accountant" ? sp.view : "own";
  return <BrandPicker view={view} />;
}
