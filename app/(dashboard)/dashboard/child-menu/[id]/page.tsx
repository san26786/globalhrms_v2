import ChildMenuTiles from "./ChildMenuTiles";

/** CI dashboard/dashboard/ChildMenu/{id} — e.g. header Settings → "Advance Setting". */
export default async function ChildMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChildMenuTiles menuId={id} />;
}
