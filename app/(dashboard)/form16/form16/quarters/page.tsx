import QuarterList from "./QuarterList";

/** CI form16/form16_quarters — Form-16 Quarters (?form16= one Form 16's). */
export default async function Form16QuartersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { form16 } = await searchParams;
  return <QuarterList form16={typeof form16 === "string" ? form16 : undefined} />;
}
