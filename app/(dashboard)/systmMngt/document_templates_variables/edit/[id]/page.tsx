import TemplateVariablesForm from "../../TemplateVariablesForm";

/** CI document_templates_variables — edit. */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateVariablesForm mode="edit" id={id} />;
}
