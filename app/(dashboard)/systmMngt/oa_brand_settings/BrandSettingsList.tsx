"use client";

import { useMemo } from "react";
import { PlusCircle } from "lucide-react";

import EntityListView from "@/components/listview/EntityListView";
import BrandTabs from "../_shared/BrandTabs";

/**
 * CI oa_brand_settings::index(): the brand's settings or attributes, Add (carries brand + kind), and the
 * brand tabs when opened for a brand. List: listDefinitions 'oa_brand_settings'.
 */
export default function BrandSettingsList({ brandId, type }: { brandId: string; type: string }) {
  const query = useMemo(() => ({ ...(brandId ? { brandId } : {}), ...(type ? { type } : {}) }), [brandId, type]);
  const isAttr = type === "ATTR";
  const addQs = new URLSearchParams(query).toString();

  return (
    <EntityListView
      list="oa_brand_settings"
      title={isAttr ? "Company Attributes" : "Company Settings"}
      query={query}
      tabs={brandId ? <BrandTabs brandId={brandId} active="attributes" /> : undefined}
      listActions={[
        {
          key: "add",
          title: isAttr ? "Add New Company Attributes" : "Add New Company Settings",
          icon: PlusCircle,
          href: `/systmMngt/oa_brand_settings/add${addQs ? `?${addQs}` : ""}`,
        },
      ]}
    />
  );
}
