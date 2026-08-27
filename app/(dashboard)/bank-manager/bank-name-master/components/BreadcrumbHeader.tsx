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
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-base text-gray-500">
            <span>Bank Manager</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-blue-600">
              Bank Name Master
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-blue-600 h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800">
              Bank Name Master
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Button */}
          <Link href="/bank-manager/bank-name-master/add">
            <Button 
              size="icon" 
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200"
              title="Add New Bank Name"
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
            className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* Delete Selected Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={onDeleteSelected}
            className="rounded-full border-red-100 hover:border-red-200 bg-white hover:bg-red-50 text-red-500 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
            title="Delete Selected"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

