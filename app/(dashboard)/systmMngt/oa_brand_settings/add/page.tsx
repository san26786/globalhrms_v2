import BrandSettingForm from "../BrandSettingForm";

/** CI oa_brand_settings/newOabBrandSettings/{brandId}/{type} → /add?brandId=&type=ATTR. */
export default async function AddBrandSettingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const brandId = typeof sp.brandId === "string" && /^\d+$/.test(sp.brandId) ? sp.brandId : undefined;
  return <BrandSettingForm mode="add" brandId={brandId} type={sp.type === "ATTR" ? "ATTR" : undefined} />;
}
