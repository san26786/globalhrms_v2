import type { ReactNode } from "react";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ImportExportControls from "@/components/import-export/ImportExportControls";
import type { ColumnSetting } from "@/lib/import-export/ExportService";
import { BreadcrumbForListView } from "@/components/breadcrumb";
import type { ParentMenuInfo } from "@/lib/breadcrumb/types";

interface BreadcrumbHeaderProps {
  entity: string;
  title: string;
  filename: string;
  columnSettings?: ColumnSetting[];
  data?: any[];
  tableRef?: any;
  onSuccess?: () => void;
  passedUrl?: string;          // replaces `section` — used by Breadcrumb, not just displayed
  parent?: ParentMenuInfo | null; // pass through once getParentByUrl is wired up server-side
  addHref?: string;
  /** Extra header buttons (e.g. Form Settings cog, Delete Selected), rendered after the Add button. */
  actions?: ReactNode;
  /** Hide the export/import controls (CI $export === false). */
  showImportExport?: boolean;
}

export default function BreadcrumbHeader({
  entity,
  title,
  filename,
  columnSettings = [],
  data = [],
  tableRef,
  onSuccess,
  passedUrl,
  parent = null,
  addHref,
  actions,
  showImportExport = true,
}: BreadcrumbHeaderProps) {
  return (
    <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm brand:relative brand:border-slate-200 dark:border-white/10 brand:shadow-[0_1px_2px_rgba(16,24,40,0.04)] brand:before:absolute brand:before:inset-x-8 brand:before:top-0 brand:before:h-1 brand:before:rounded-b-full brand:before:bg-gradient-to-r brand:before:from-[#e15425] brand:before:to-[#0b5394]">
      <div className="flex items-start justify-between">
        <div>
          <BreadcrumbForListView
            passedUrl={passedUrl}
            parameters={title}
            parent={parent}
          />

          <div className="mt-2 flex items-center gap-2 brand:mt-3 brand:gap-3">
            <Database className="text-blue-600 brand:h-11 brand:w-11 brand:shrink-0 brand:rounded-xl brand:bg-[#fbe6dd] brand:p-2.5 brand:text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]" />
            <h1 className="text-4xl font-bold brand:font-semibold brand:text-[28px] brand:leading-tight brand:tracking-[-0.03em] brand:text-[#1a1818] dark:text-[#f1f3f8] brand:md:text-[32px]">{title}</h1>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {showImportExport && (
          <ImportExportControls
            entity={entity}
            title={title}
            filename={filename}
            columnSettings={columnSettings}
            data={data}
            tableRef={tableRef}
            onSuccess={onSuccess}
          />
          )}
          {addHref && (
            <Link href={addHref}>
              <Button size="icon" className="rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}