import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";
import ConfigMappingList from "./configMappingList";

/**
 * CI common/config_mapping_dtl/index/{configTypeId} → /common/config-mapping?typeId={configTypeId}
 * (header "Menu Item Config" = 84, "GS Item Config" = 36); no typeId = every mapping.
 */
export default async function ConfigMappingPage({ searchParams }: { searchParams: PageSearchParams }) {
  const typeId = positiveIntParam((await searchParams).typeId);
  return <ConfigMappingList key={typeId ?? 0} typeId={typeId} />;
}
