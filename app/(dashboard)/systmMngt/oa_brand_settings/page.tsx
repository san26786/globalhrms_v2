import BrandSettingsList from "./BrandSettingsList";

/**
 * CI systmMngt/oa_brand_settings/index/{brandId}/{type} → /systmMngt/oa_brand_settings?brandId=&type=ATTR
 * ("Company Settings", or with type=ATTR the brand tab "Company Attributes").
 */
export default async function OaBrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const brandId = typeof sp.brandId === "string" && /^\d+$/.test(sp.brandId) && sp.brandId !== "0" ? sp.brandId : "";
  const type = sp.type === "ATTR" ? "ATTR" : "";
  return <BrandSettingsList brandId={brandId} type={type} />;
}
