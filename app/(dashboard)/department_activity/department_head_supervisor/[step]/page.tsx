import { notFound } from "next/navigation";

import { exitStepBySegment } from "@/lib/employeeMngt/hub/defs/exit_clearance";
import { ExitStepEntry } from "../_exit/ExitSteps";

/** CI department_activity/{gna_and_admin|account_finance|facilities_it|human_resource}/{EMP_ID} — the department's record of the employee (?emp=). */
export default async function ExitStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const step = exitStepBySegment((await params).step);
  if (!step) notFound();
  const { emp } = await searchParams;
  return <ExitStepEntry step={step.key} emp={typeof emp === "string" ? emp : undefined} />;
}
