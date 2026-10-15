import SalaryComponentForm from "../../SalaryComponentForm";

/** CI salary_component_settings — edit. */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalaryComponentForm mode="edit" id={id} />;
}
