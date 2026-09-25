import AttributeListPage from "./attributeList";

/** CI entity/entity_obj_attrbt/index/{OBJ_NM} — `?objNm=` filters by object. */
export default async function EntityObjAttrbtPage({
  searchParams,
}: {
  searchParams: Promise<{ objNm?: string | string[] }>;
}) {
  const { objNm } = await searchParams;
  return <AttributeListPage objNm={typeof objNm === "string" && objNm ? objNm : undefined} />;
}
