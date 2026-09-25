import ConfigMappingFormPage from "@/components/common/config-mapping-form";
import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";

/** CI common/config_mapping_dtl/addConfigMappingDetails/{configTypeId} → /common/config-mapping/add-config-mapping?typeId=… */
export default async function AddConfigMappingPage({ searchParams }: { searchParams: PageSearchParams }) {
  const typeId = positiveIntParam((await searchParams).typeId);
  return <ConfigMappingFormPage key={typeId ?? 0} mode="add" typeId={typeId} />;
}
