import FormPage from "../../userRoleForm";

export default async function EditUserRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
