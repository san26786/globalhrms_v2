"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Exit and Clearance navigation (Employee Hub), so each page gets the brand look and page-turn entrance. */
export default function ExitClearanceTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
