import DocumentTemplateForm from "../../DocumentTemplateForm";

/** CI document_template — edit. */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentTemplateForm mode="edit" id={id} />;
}
