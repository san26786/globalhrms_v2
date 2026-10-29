"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Organisation navigation, so each page gets the brand look and page-turn entrance. */
export default function OrgAccountsTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
