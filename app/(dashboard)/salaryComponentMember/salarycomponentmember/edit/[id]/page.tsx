import ComponentMemberForm from "../../ComponentMemberForm";

/** CI salaryComponentMember/salarycomponentmember — edit. */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComponentMemberForm mode="edit" id={id} />;
}
