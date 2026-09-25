import FormPage from "../../domainForm";

export default async function EditUserDomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
