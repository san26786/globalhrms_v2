import MasterDataFormPage from "@/components/common/master-data-form";
import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";

/** CI common/indp_mst_data/addIndependentData/{typeId} → /common/master-data/add-master-data?typeId={typeId}. */
export default async function AddMasterDataPage({ searchParams }: { searchParams: PageSearchParams }) {
  const typeId = positiveIntParam((await searchParams).typeId);
  return <MasterDataFormPage key={typeId ?? 0} mode="add" typeId={typeId} />;
}
