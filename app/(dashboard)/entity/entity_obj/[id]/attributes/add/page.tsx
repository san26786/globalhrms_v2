import AttributeFormPage from "../../../../entity_obj_attrbt/attributeForm";

/** Add an attribute from the entity's Attributes tab (object fixed). */
export default async function AddEntityAttributePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AttributeFormPage mode="add" parentObjId={id} returnPath={`/entity/entity_obj/${id}?tab=attributes`} />;
}
