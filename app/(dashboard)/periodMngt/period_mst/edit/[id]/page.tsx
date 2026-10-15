import PeriodForm from "../../PeriodForm";

/** CI periodMngt/period_mst/editPeriod/{id}. */
export default async function EditPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PeriodForm mode="edit" id={id} />;
}
