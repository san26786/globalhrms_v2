"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Company Documents navigation, so each page gets the brand look and page-turn entrance. */
export default function CompanyDocumentsTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
