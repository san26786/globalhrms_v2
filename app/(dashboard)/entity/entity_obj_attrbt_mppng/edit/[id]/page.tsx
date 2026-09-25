import AttributeMappingFormPage from "../../attributeMappingForm";

export default async function EditEntityObjAttrbtMppngPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AttributeMappingFormPage mode="edit" id={id} />;
}
