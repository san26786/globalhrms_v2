import QuarterForm from "../QuarterForm";

/** CI form16/form16_quarters/newform16quarterdetail[/{form16_id}] — add a quarter (?form16= for that Form 16, from its "Add Items"). */
export default async function Form16QuarterAddPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { form16 } = await searchParams;
  return <QuarterForm mode="add" form16={typeof form16 === "string" ? form16 : undefined} />;
}
