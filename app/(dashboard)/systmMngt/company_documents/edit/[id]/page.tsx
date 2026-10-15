import CompanyDocumentForm from "../../CompanyDocumentForm";

/** CI company_documents — edit. */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDocumentForm mode="edit" id={id} />;
}
