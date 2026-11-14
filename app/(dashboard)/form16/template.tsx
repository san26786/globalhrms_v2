"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Form 16 navigation (Payroll), so each page gets the brand look and page-turn entrance. */
export default function Form16Template({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
