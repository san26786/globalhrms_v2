import MasterDataFormPage from "@/components/common/master-data-form";
import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";

/**
 * CI common/indp_mst_data/editIndependentData/{id}/{typeId}
 *   → /common/master-data/edit-master-data/{id}?typeId={typeId}.
 */
export default async function EditMasterDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const typeId = positiveIntParam(query.typeId);
  return <MasterDataFormPage key={`${id}:${typeId ?? 0}`} mode="edit" id={id} typeId={typeId} />;
}
