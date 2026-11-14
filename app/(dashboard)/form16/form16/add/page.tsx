import Form16Form from "../Form16Form";

/** CI form16/form16/newform16detail — add a Form 16 (?emp= preselects the employee). */
export default async function Form16AddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <Form16Form mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
