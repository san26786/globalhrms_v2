"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Outdoor Allowance navigation (Payroll), so each page gets the brand look and page-turn entrance. */
export default function OutdoorAllowanceTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
