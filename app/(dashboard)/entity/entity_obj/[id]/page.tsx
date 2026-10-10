import EntityDetails from "./EntityDetails";
import { toEntityTab } from "./entityTabs";

/** Entity object details: General / Attributes / Display / Mapping / Dependency / Privileges (`?tab=`). */
export default async function EntityObjDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <EntityDetails id={id} initialTab={toEntityTab(tab)} />;
}
