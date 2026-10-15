import BrandSettingForm from "../../BrandSettingForm";

/** CI oa_brand_settings/editOaBrandSettings/{id}/{brandId}/{type} → /edit/{id} (brand and kind come from the row). */
export default async function EditBrandSettingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BrandSettingForm mode="edit" id={id} />;
}
