"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Last Login Details navigation, so each page gets the brand look and page-turn entrance. */
export default function LastLoginTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
