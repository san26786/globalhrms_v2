import { notFound } from "next/navigation";

import { isHubScreen } from "@/lib/employeeMngt/hub/hubTypes";
import HubForm from "../../../_hub/HubForm";

/** CI employeeMngt/<screen>/edit…Dtl/{id}[/{EMP_ID}] — edit an Employee Hub record. */
export default async function HubEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen, id } = await params;
  if (!isHubScreen(screen)) notFound();
  const { emp } = await searchParams;
  return <HubForm screen={screen} mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
