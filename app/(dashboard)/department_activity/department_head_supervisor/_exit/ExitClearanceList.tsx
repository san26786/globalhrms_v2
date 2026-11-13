"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, FileDown, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";

import type { ExitDocument } from "@/lib/employeeMngt/exitDocuments";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../../../employeeMngt/_hub/HubList";
import { downloadExitDocument, generateExitForm, stepEntry } from "./exitClient";

/**
 * CI department_activity/department_head_supervisor[/index/{EMP_ID}] — the exit clearances; a row opens its
 * departments and, as CI, offers the exit form (admins preview / generate it; once generated, anyone who
 * sees the row downloads it, the relieving order and the experience letter). Before generation the letters
 * come from the Human Resource form's buttons (ExitHrForm). PDFs: lib/employeeMngt/exitDocuments.
 */
const generated = (row: HubRow) => row.IS_GENERATED === "Yes";

async function download(row: HubRow, document: ExitDocument) {
  try {
    await downloadExitDocument(row.id, document);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not create the document.");
  }
}

export default function ExitClearanceList({ emp }: { emp?: string }) {
  const router = useRouter();
  const session = useCurrentSession();
  const admin = (session?.userLevel ?? 0) > 0;
  // Remounting the list reloads it after a generate.
  const [version, setVersion] = useState(0);

  const generate = async (row: HubRow) => {
    try {
      toast.success(await generateExitForm(row.id));
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the exit form.");
    }
  };

  return (
    <HubList
      key={version}
      screen="exit_clearance"
      emp={emp}
      rowActions={[
        {
          label: "Department Clearance",
          icon: ListChecks,
          onClick: (row) => router.push(stepEntry("exit_gna", String(row.EMPLOYEE_ID))),
        },
        { label: "Preview Exit Form", icon: FileText, separator: true, show: (row) => admin && !generated(row), onClick: (row) => download(row, "exit-form") },
        { label: "Generate Exit Form", icon: FileCheck2, show: (row) => admin && !generated(row), onClick: generate },
        { label: "Download Exit Form", icon: FileDown, separator: true, show: generated, onClick: (row) => download(row, "exit-form") },
        { label: "Relieving Order", icon: FileDown, show: generated, onClick: (row) => download(row, "relieving-order") },
        { label: "Experience Letter", icon: FileDown, show: generated, onClick: (row) => download(row, "experience-letter") },
      ]}
    />
  );
}
