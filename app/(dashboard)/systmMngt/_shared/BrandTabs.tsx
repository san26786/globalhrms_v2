"use client";

import Link from "next/link";

/**
 * CI include/tabs_v for a brand (oa_brands edit, company_documents, oa_brand_settings /ATTR):
 * OA Brands · Company Documents · Company Attributes.
 */
export type BrandTab = "brand" | "documents" | "attributes";

export default function BrandTabs({ brandId, active }: { brandId: number | string; active: BrandTab }) {
  const id = encodeURIComponent(String(brandId));
  const tabs: Array<{ key: BrandTab; label: string; href: string }> = [
    { key: "brand", label: "OA Brands", href: `/systmMngt/oa_brands/edit/${id}` },
    { key: "documents", label: "Company Documents", href: `/systmMngt/company_documents?brandId=${id}` },
    { key: "attributes", label: "Company Attributes", href: `/systmMngt/oa_brand_settings?brandId=${id}&type=ATTR` },
  ];
  return (
    <nav aria-label="Brand sections" className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${t.key === active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
