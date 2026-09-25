import { positiveIntParam, type PageSearchParams } from "@/lib/common/searchParams";
import MasterDataList from "./masterDataList";

/**
 * CI common/indp_mst_data/index/{typeId} → /common/master-data?typeId={typeId}.
 * Without `typeId` it lists every master with a "System Entity" filter (CI index()).
 */
export default async function MasterDataPage({ searchParams }: { searchParams: PageSearchParams }) {
  const typeId = positiveIntParam((await searchParams).typeId);
  return <MasterDataList key={typeId ?? 0} typeId={typeId} />;
}
