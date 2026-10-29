"use client";

import { BrandModule } from "@/components/dashboard/DashboardUi";

/** Re-mounts on every Company Info (OA Brands) navigation, so each page gets the brand look and page-turn entrance. */
export default function OaBrandsTemplate({ children }: { children: React.ReactNode }) {
  return <BrandModule>{children}</BrandModule>;
}
