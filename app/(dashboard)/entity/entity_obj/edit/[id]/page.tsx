import EntityObjFormPage from "../../entityObjForm";

export default async function EditEntityObjPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityObjFormPage mode="edit" id={id} />;
}
