"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import HubForm from "../../../employeeMngt/_hub/HubForm";
import { LIST, clearanceOf, downloadExitDocument, formHref, generateExitForm, nextAfter, type ClearanceState } from "./exitClient";

/**
 * CI department_activity/human_resource::initForm / insert / update: the Human Resource step with CI's form
 * buttons, each of which saves the record first and then
 *   - "Save and Preview": the exit form PDF (CI previewExitForm);
 *   - while the exit form is not generated, for admins:
 *     - "Save And Generate": generates it and returns to the clearance list (CI generateExitForm);
 *     - "Generate Relieving Order" / "Generate Experience Letter": the letter's PDF, before the exit form is
 *       generated (CI generateRelievingOrder / generateExperienceLetter; afterwards the list offers them).
 * Save alone goes on to the clearance list, as CI. PDFs and who may get them: lib/employeeMngt/exitDocuments.
 *
 * Behaviour changes: the buttons show to those who may save the step (CI offered "Save and Preview" to every
 * user; every exit clearance write is admin-only here, see hub/screens/exit_clearance); the PDF downloads and
 * the form stays open on the saved record (CI left the browser on the PDF); a document that cannot be made
 * (e.g. no Exit Form Setting) says why, the save stands (CI redirected with a warning).
 * The buttons are HubForm `extraSaves`: the step's own validation and save run first.
 */
const STEP = "exit_hr";

type Action = "preview" | "generate" | "relieving-order" | "experience-letter";
const ACTIONS: Array<{ action: Action; label: string; adminBeforeGenerated?: true }> = [
  { action: "preview", label: "Save and Preview" },
  { action: "generate", label: "Save And Generate", adminBeforeGenerated: true },
  { action: "relieving-order", label: "Generate Relieving Order", adminBeforeGenerated: true },
  { action: "experience-letter", label: "Generate Experience Letter", adminBeforeGenerated: true },
];

export default function ExitHrForm({ mode, id, emp }: { mode: "add" | "edit"; id?: string; emp?: string }) {
  const router = useRouter();
  const [clearance, setClearance] = useState<ClearanceState | null>(null);

  useEffect(() => {
    if (!emp) return;
    let cancelled = false;
    clearanceOf(emp)
      .then((c) => !cancelled && setClearance(c))
      .catch(() => !cancelled && setClearance(null));
    return () => {
      cancelled = true;
    };
  }, [emp]);

  /** After the save: the button's document, then the list (generate) or this record's edit form. */
  const follow = async (action: Action, employee: string, recordId: number | null) => {
    try {
      const { id: clearanceId } = await clearanceOf(employee);
      if (!clearanceId) throw new Error("Start the exit clearance (Department Head / Supervisor) first.");
      if (action === "generate") {
        toast.success(await generateExitForm(clearanceId));
        router.push(LIST);
        return;
      }
      await downloadExitDocument(clearanceId, action === "preview" ? "exit-form" : action);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the document.");
    }
    // A record just added is edited from now on.
    if (mode === "add" && recordId) router.replace(formHref(STEP, employee, recordId));
  };

  // CI: "Save and Preview" for whoever may save; the rest for admins (who may generate) until it is generated.
  const mayGenerate = !!clearance?.canUpdate && !clearance.generated;
  const buttons = clearance?.id ? ACTIONS.filter((a) => !a.adminBeforeGenerated || mayGenerate) : [];

  return (
    <HubForm
      screen={STEP}
      mode={mode}
      id={id}
      emp={emp}
      back={LIST}
      next={(employee) => nextAfter(STEP, employee)}
      extraSaves={buttons.map((b) => ({ key: b.action, label: b.label, after: (employee, recordId) => void follow(b.action, employee, recordId) }))}
    />
  );
}
