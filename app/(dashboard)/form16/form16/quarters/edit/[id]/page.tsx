import QuarterForm from "../../QuarterForm";

/**
 * CI form16/form16_quarters/editform16quarterdetail/{id}[/{form16_id}] — edit a quarter. Opened from its Form 16 it returns
 * there; ?from=list (the quarters list) returns to the list, as CI without a form16_id.
 */
export default async function Form16QuarterEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  return <QuarterForm mode="edit" id={id} fromList={from === "list"} />;
}
