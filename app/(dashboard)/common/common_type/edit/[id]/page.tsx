import EntityFormPage from "@/components/common/entities-form";

/** CI common/common_type/editCommonType/{typeId}. */
export default async function EditCommonTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityFormPage mode="edit" id={id} />;
}
