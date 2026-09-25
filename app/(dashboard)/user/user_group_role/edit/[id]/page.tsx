import FormPage from "../../groupRoleForm";

export default async function EditUserGroupRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
