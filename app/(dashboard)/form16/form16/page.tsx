import Form16List from "./Form16List";

/** CI form16/form16 — Form 16 (?emp= one employee). */
export default async function Form16Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { emp } = await searchParams;
  return <Form16List emp={typeof emp === "string" ? emp : undefined} />;
}
