import PeriodList from "./PeriodList";

/**
 * CI periodMngt/period_mst/index/{periodTypeId}/{periodStatusId} (and changeType/{periodTypeId})
 * → /periodMngt/period_mst?periodTypeId=&periodStatusId= (old CI URLs are redirected here by
 * proxy.ts through the route registry).
 */
export default async function PeriodMasterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" && /^\d+$/.test(v) && v !== "0" ? v : "";
  };
  return <PeriodList periodTypeId={one("periodTypeId")} periodStatusId={one("periodStatusId")} />;
}
