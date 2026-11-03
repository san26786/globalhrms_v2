"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Job Detail navigation (Employee Hub), so each page gets the brand look and page-turn entrance. */
export default function JobTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
