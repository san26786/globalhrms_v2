import MyAnnexuresList from "./MyAnnexuresList";

/** CI employeeMngt/emp_sal_component_mst/annexures (and emp_annexures/{EMP_ID}) — My Annexures (?emp= one employee). */
export default async function MyAnnexuresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <MyAnnexuresList emp={typeof emp === "string" ? emp : undefined} />;
}
