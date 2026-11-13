"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Timesheet navigation, so each page gets the Employee Hub brand look and page-turn entrance. */
export default function TimesheetTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
