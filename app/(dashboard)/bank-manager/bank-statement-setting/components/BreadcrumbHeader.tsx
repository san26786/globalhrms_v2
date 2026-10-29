import { 
  ChevronRight, 
  Database, 
  Plus, 
  Settings, 
  Trash2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ImportExportControls from "@/components/import-export/ImportExportControls";
import { ColumnSetting } from "@/lib/import-export/ExportService";

interface BreadcrumbHeaderProps {
  onOpenSettings?: () => void;
  onDeleteSelected?: () => void;
  entity: string;
  title: string;
  filename: string;
  columnSettings: ColumnSetting[];
  data: any[];
  tableRef?: any;
  onSuccess?: () => void;
}

export default function BreadcrumbHeader({ 
  onOpenSettings, 
  onDeleteSelected,
  entity,
  title,
  filename,
  columnSettings,
  data,
  tableRef,
  onSuccess
}: BreadcrumbHeaderProps) {
  return (
    <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-base text-[#535768] dark:text-[#aab3c5]">
            <span>Bank Manager</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">
              Bank Statement Setting
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-[#0b5394] dark:text-[#8cb8f0] h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8]">
              Bank Statement Setting
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Button */}
          <Link href="/bank-manager/bank-statement-setting/add">
            <Button 
              size="icon" 
              className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:shadow-[#e15425]/40 hover:scale-105 active:scale-95 transition-all duration-200"
              title="Configure Bank Statement Setting"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </Button>
          </Link>

          {/* Centralized Import & Export Controls */}
          <ImportExportControls
            entity={entity}
            title={title}
            filename={filename}
            columnSettings={columnSettings}
            data={data}
            tableRef={tableRef}
            onSuccess={onSuccess}
          />

          {/* Settings Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* Delete Selected Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onDeleteSelected}
            className="rounded-full border-rose-200 dark:border-rose-400/30 hover:border-rose-300 dark:hover:border-rose-400/50 bg-white dark:bg-[#111a2e] hover:bg-rose-50 dark:hover:bg-rose-400/10 text-rose-700 dark:text-rose-300 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
            title="Delete Selected"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

