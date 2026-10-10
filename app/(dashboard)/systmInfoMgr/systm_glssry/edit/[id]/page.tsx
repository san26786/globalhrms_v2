import GlossaryFormPage from "../../glossaryForm";

export default async function EditSystemGlossaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GlossaryFormPage mode="edit" id={id} />;
}
