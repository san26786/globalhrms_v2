import SettingFormPage from "../../settingForm";

export default async function EditSystemSettingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SettingFormPage mode="edit" id={id} />;
}
