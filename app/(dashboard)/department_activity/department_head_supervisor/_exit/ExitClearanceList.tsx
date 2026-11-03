"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, FileDown, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { authFetch } from "@/lib/auth/authFetch";
import { useCurrentSession } from "@/lib/header/HeaderSessionContext";
import HubList, { type HubRow } from "../../../employeeMngt/_hub/HubList";
import { stepEntry } from "./ExitSteps";

/**
 * CI department_activity/department_head_supervisor[/index/{EMP_ID}] — the exit clearances; a row opens its
 * departments and, as CI, offers the exit form (admins preview / generate it; once generated, anyone who
 * sees the row downloads it, the relieving order and the experience letter). PDFs: lib/employeeMngt/exitDocuments.
 */
const API = "/api/department_activity/department_head_supervisor";
const generated = (row: HubRow) => row.IS_GENERATED === "Yes";

async function download(row: HubRow, document: string) {
  try {
    const res = await authFetch(`${API}/${row.id}/${document}`);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(json?.message ?? "Could not create the document.");
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `${document}.pdf`;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(window.document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
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
    const res = await authFetch(`${API}/${row.id}/exit-form`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) return toast.error(json?.message ?? "Could not generate the exit form.");
    toast.success(json.message ?? "Exit form generated.");
    setVersion((v) => v + 1);
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
