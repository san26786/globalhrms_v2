import ListDetailFormPage from "../../listDetailForm";

export default async function EditSystemListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListDetailFormPage mode="edit" id={id} />;
}
