import OrderSettingsForm from "./OrderSettingsForm";

/** CI organisation/invoice_setting/getSpecificSetting/{settingId} — Purchase Order (5569) / Sales Order (5570) Setting. */
export default async function InvoiceSettingPage({ searchParams }: { searchParams: Promise<{ settingId?: string }> }) {
  const { settingId } = await searchParams;
  return <OrderSettingsForm settingId={settingId ?? ""} />;
}
