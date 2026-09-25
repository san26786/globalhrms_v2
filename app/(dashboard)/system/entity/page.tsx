import { redirect } from "next/navigation";

/** Legacy placeholder route — the Entity module lives at /entity/entity_obj (CI entity/entity_obj). */
export default function SystemEntityPage() {
  redirect("/entity/entity_obj");
}
