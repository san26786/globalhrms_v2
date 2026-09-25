"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UtilityCard, UtilityPage } from "../_components/UtilityPage";
import { downloadFile } from "../_components/download";

type ExportType = "withoutData" | "withData";

/**
 * CI utilities/export_employee — "Without Data" downloads the employee import template (header row
 * only), "With Data" the employees of the active brand, as Employee_Data_YYYYMMDD.csv.
 */
export default function ExportEmployeePage() {
  const [exportType, setExportType] = useState<ExportType>("withoutData");
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      await downloadFile(`/api/utilities/export_employee?withData=${exportType === "withData" ? 1 : 0}`, "Employee_Data.csv");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <UtilityPage title="Export Employee">
      <UtilityCard>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            Export <span className="text-red-500">*</span>
          </Label>
          <RadioGroup value={exportType} onValueChange={(v) => setExportType(v as ExportType)} className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="withoutData" id="withoutData" />
              <Label htmlFor="withoutData" className="font-normal">Without Data (template)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="withData" id="withData" />
              <Label htmlFor="withData" className="font-normal">With Data</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-slate-500">
            &quot;With Data&quot; exports the employees of your current brand, including Aadhar and PAN numbers.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={exportNow} disabled={busy}>
            <Download className="mr-2 h-4 w-4" />
            {busy ? "Exporting…" : "Export Employee"}
          </Button>
        </div>
      </UtilityCard>
    </UtilityPage>
  );
}
