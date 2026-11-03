"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Employee Hub navigation, so each page gets the brand look and page-turn entrance. */
export default function EmployeeHubTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
