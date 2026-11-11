import AnnexureProcessingList from "./AnnexureProcessingList";

/** CI employeeMngt/emp_sal_component_mst/indexAnnexures — Annexure Processing (admins; ?emp= one employee). */
export default async function AnnexureProcessingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <AnnexureProcessingList emp={typeof emp === "string" ? emp : undefined} />;
}
