import { notFound } from "next/navigation";

import { isHubScreen } from "@/lib/employeeMngt/hub/hubTypes";
import HubList from "../_hub/HubList";

/** CI employeeMngt/<screen>[/index/{EMP_ID}] — an Employee Hub record list (?emp= one employee). */
export default async function HubListPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  if (!isHubScreen(screen)) notFound();
  const { emp } = await searchParams;
  return <HubList screen={screen} emp={typeof emp === "string" ? emp : undefined} />;
}
