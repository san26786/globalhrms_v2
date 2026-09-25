import FormPage from "../../groupForm";

export default async function EditUserGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
