import { Download, Eye } from "lucide-react";

import type { RowAction } from "@/components/DataTable/types";
import type { HubRow } from "../../_hub/HubList";

/** View / download a payslip's PDF (rendered on demand; the access token cookie authorises it). */
export const payslipActions: RowAction<HubRow>[] = [
  { label: "View Payslip", icon: Eye, onClick: (r) => window.open(`/api/payroll/payslips/${r.id}/document`, "_blank", "noopener") },
  { label: "Download Payslip", icon: Download, onClick: (r) => window.location.assign(`/api/payroll/payslips/${r.id}/document?download=1`) },
];

export const currentMonth = () => {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};
