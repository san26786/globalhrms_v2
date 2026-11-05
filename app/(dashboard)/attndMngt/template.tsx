"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Payroll Attendance Summary navigation (Payroll), so each page gets the brand look and page-turn entrance. */
export default function AttendanceTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
