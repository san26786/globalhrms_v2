import { notFound } from "next/navigation";

import { isHubScreen } from "@/lib/employeeMngt/hub/hubTypes";
import HubForm from "../../_hub/HubForm";

/** CI employeeMngt/<screen>/add…Dtl[/{EMP_ID}] — add an Employee Hub record (?emp= preselects the employee). */
export default async function HubAddPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  if (!isHubScreen(screen)) notFound();
  const { emp } = await searchParams;
  return <HubForm screen={screen} mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
