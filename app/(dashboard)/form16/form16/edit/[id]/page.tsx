import Form16Form from "../../Form16Form";
import Form16Quarters from "../../Form16Quarters";

/** CI form16/form16/editform16detail/{id} — edit a Form 16, preview / generate its PDF, and its quarters (CI child table). */
export default async function Form16EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { emp } = await searchParams;
  return (
    <>
      <Form16Form mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />
      <Form16Quarters id={id} />
    </>
  );
}
