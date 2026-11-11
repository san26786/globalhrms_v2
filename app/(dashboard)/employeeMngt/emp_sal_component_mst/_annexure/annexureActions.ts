import { Download, Eye } from "lucide-react";

import type { RowAction } from "@/components/DataTable/types";
import type { HubRow } from "../../_hub/HubList";

/** View / download an annexure's PDF (rendered on demand; the access token cookie authorises it). */
export const documentActions: RowAction<HubRow>[] = [
  { label: "View Annexure", icon: Eye, onClick: (r) => window.open(`/api/payroll/annexures/${r.id}/document`, "_blank", "noopener") },
  { label: "Download Annexure", icon: Download, onClick: (r) => window.location.assign(`/api/payroll/annexures/${r.id}/document?download=1`) },
];

export const STATUSES = [
  { value: "EMSC", label: "Current" },
  { value: "EMSF", label: "Former" },
  { value: "all", label: "All employees" },
];
