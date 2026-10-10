import ConfigMappingFormPage from "@/components/common/config-mapping-form";
import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";

/** CI common/config_mapping_dtl/editConfigMappingDetails/{id} → /common/config-mapping/edit-config-mapping/{id}?typeId=… */
export default async function EditConfigMappingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ConfigMappingFormPage key={id} mode="edit" id={id} typeId={positiveIntParam(query.typeId)} />;
}
