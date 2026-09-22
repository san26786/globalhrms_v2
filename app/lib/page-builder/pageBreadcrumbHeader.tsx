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
}: BreadcrumbHeaderProps) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <BreadcrumbForListView
            passedUrl={passedUrl}
            parameters={title}
            parent={parent}
          />

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-blue-600" />
            <h1 className="text-4xl font-bold">{title}</h1>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <ImportExportControls
            entity={entity}
            title={title}
            filename={filename}
            columnSettings={columnSettings}
            data={data}
            tableRef={tableRef}
            onSuccess={onSuccess}
          />
          {addHref && (
            <Link href={addHref}>
              <Button size="icon" className="rounded-full">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}