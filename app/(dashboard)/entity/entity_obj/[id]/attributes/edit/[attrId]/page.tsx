import AttributeFormPage from "../../../../../entity_obj_attrbt/attributeForm";

/** Edit an attribute from the entity's Attributes tab. */
export default async function EditEntityAttributePage({
  params,
}: {
  params: Promise<{ id: string; attrId: string }>;
}) {
  const { id, attrId } = await params;
  return <AttributeFormPage mode="edit" id={attrId} returnPath={`/entity/entity_obj/${id}?tab=attributes`} />;
}
