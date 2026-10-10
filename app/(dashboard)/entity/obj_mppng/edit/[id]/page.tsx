import ObjMappingFormPage from "../../objMappingForm";

export default async function EditObjMppngPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ObjMappingFormPage mode="edit" id={id} />;
}
