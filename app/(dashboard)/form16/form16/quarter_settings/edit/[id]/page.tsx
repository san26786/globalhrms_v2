import QuarterSettingForm from "../../QuarterSettingForm";

/** CI form16/form16_quarter_settings/editform16quartersettingsdetail/{id} — edit a quarter setting. */
export default async function Form16QuarterSettingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuarterSettingForm mode="edit" id={id} />;
}
