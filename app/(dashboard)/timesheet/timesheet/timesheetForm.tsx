"use client";

import { useRouter } from "next/navigation";

import ResourceFormPage from "@/components/resource/ResourceFormPage";

/**
 * CI timesheet/timesheet::newTimesheet / ::editTimesheet (formview_v). Fields, values, buttons
 * (Request Approval, Approve / Reject, Copy …) and the items table come from the init endpoint
 * (lib/timesheet/timesheet.form). From the team list (CI …/TEAM) Cancel and the buttons return there.
 * A new timesheet opens in edit mode, where its items are added (CI "Do you want to add Timesheet Activity?").
 */
export default function TimesheetForm({ mode, id, team = false }: { mode: "add" | "edit"; id?: string; team?: boolean }) {
  const router = useRouter();
  const basePath = team ? "/timesheet/timesheet/team" : "/timesheet/timesheet";
  return (
    <ResourceFormPage
      breadcrumb={["Timesheet", team ? "Team Timesheets" : "My Timesheet"]}
      mode={mode}
      id={id}
      apiPath="/api/timesheet/timesheet"
      basePath={basePath}
      initUrl="/api/timesheet/timesheet/init"
      onSaved={(data) => {
        const newId = (data as { id?: number } | null)?.id;
        router.push(mode === "add" && newId ? `${basePath}/edit/${newId}` : basePath);
      }}
    />
  );
}
