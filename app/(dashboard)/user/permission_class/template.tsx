"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Permission Class navigation, so each page gets the brand look and page-turn entrance. */
export default function PermissionClassTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
