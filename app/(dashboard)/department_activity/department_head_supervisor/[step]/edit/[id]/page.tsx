import { notFound } from "next/navigation";

import { exitStepBySegment } from "@/lib/employeeMngt/hub/defs/exit_clearance";
import { ExitStepForm } from "../../../_exit/ExitSteps";

/** CI department_activity/<department>/edit…/{id}/{EMP_ID} — edit a department's clearance of the employee. */
export default async function ExitStepEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { step: segment, id } = await params;
  const step = exitStepBySegment(segment);
  if (!step) notFound();
  const { emp } = await searchParams;
  return <ExitStepForm step={step.key} mode="edit" id={id} emp={typeof emp === "string" ? emp : undefined} />;
}
