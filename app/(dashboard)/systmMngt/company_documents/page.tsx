"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import EntityListView from "@/components/listview/EntityListView";
import type { RowAction } from "@/components/DataTable/types";
import { authFetch } from "@/lib/auth/authFetch";

/**
 * CI systmMngt/company_documents::index() — the brand's company documents, "Add New File", edit /
 * delete per row, plus Download (CI linked the file publicly from the edit form; here it is an
 * authenticated, brand-checked download).
 */
type Row = Record<string, unknown>;

async function download(row: Row) {
  try {
    const res = await authFetch(`/api/systmMngt/company_documents/${encodeURIComponent(String(row.ID))}/file`);
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(json?.message ?? "Document Not Found!!");
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "document";
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Document Not Found!!");
  }
}

export default function CompanyDocumentsPage() {
  const rowActions = (): RowAction<Row>[] => [{ label: "Download", icon: Download, onClick: (row) => void download(row) }];
  return <EntityListView list="company_documents" rowActions={rowActions} />;
}
