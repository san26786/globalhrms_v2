import BrandForm from "../../BrandForm";

/** CI systmMngt/oa_brands/editOaBrands/{id} (no longer switches the session brand). */
export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BrandForm id={id} />;
}
