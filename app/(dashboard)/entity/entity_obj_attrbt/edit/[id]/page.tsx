import AttributeFormPage from "../../attributeForm";

export default async function EditEntityObjAttrbtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AttributeFormPage mode="edit" id={id} returnPath="/entity/entity_obj_attrbt" />;
}
