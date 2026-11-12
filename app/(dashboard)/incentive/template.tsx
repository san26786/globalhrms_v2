"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Incentive navigation (Payroll), so each page gets the brand look and page-turn entrance. */
export default function IncentiveTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
