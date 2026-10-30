import ChildMenuTiles from "./ChildMenuTiles";

/** CI dashboard/dashboard/ChildMenu/{id} — ?menuId=… (e.g. header Settings → "Advance Setting"). */
export default async function ChildMenuPage({ searchParams }: { searchParams: Promise<{ menuId?: string }> }) {
  const { menuId } = await searchParams;
  return <ChildMenuTiles menuId={menuId ?? ""} />;
}
