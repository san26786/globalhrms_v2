import { notFound } from "next/navigation";

import { exitStepBySegment } from "@/lib/employeeMngt/hub/defs/exit_clearance";
import { ExitStepForm } from "../../_exit/ExitSteps";

/** CI department_activity/<department>/new…/{EMP_ID} — a department's clearance of the employee (?emp=). */
export default async function ExitStepAddPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const step = exitStepBySegment((await params).step);
  if (!step) notFound();
  const { emp } = await searchParams;
  return <ExitStepForm step={step.key} mode="add" emp={typeof emp === "string" ? emp : undefined} />;
}
