import FormPage from "../../authorityLevelForm";

export default async function EditAuthorityLevelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormPage mode="edit" id={id} />;
}
