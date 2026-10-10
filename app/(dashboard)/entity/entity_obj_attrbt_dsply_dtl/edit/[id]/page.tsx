import DisplayDetailFormPage from "../../displayDetailForm";

export default async function EditEntityObjAttrbtDsplyDtlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisplayDetailFormPage mode="edit" id={id} />;
}
