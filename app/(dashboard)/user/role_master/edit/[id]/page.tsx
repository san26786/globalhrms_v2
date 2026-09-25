import FormPage from "../../roleForm";

export default async function EditRoleMasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
