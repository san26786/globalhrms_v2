import FormPage from "../../mappingForm";

export default async function EditUserTypeRoleMappingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
