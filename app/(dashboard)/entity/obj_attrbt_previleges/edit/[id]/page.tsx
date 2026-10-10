import PrivilegeFormPage from "../../privilegeForm";

export default async function EditObjAttrbtPrevilegesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrivilegeFormPage mode="edit" id={id} />;
}
