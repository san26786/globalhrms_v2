import { 
  ChevronRight, 
  Database, 
  Plus, 
  LogOut, 
  Settings, 
  Trash2, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Copy 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface BreadcrumbHeaderProps {
  onOpenSettings?: () => void;
  onDeleteSelected?: () => void;
  onExport?: (format: string) => void;
}

export default function BreadcrumbHeader({ 
  onOpenSettings, 
  onDeleteSelected,
  onExport
}: BreadcrumbHeaderProps) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-base text-gray-500">
            <span>Bank Manager</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-blue-600">
              Bank Statement Setting
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-blue-600 h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800">
              Bank Statement Setting
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Button */}
          <Link href="/bank-manager/bank-statement-setting/add">
            <Button 
              size="icon" 
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200"
              title="Configure Bank Statement Setting"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </Button>
          </Link>

          {/* Export Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
                title="Export Options"
              >
                <LogOut className="h-5 w-5 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 w-32">
              <DropdownMenuItem onClick={() => onExport?.("CSV")} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("EXCEL")} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>EXCEL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("PDF")} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                <FileText className="h-4 w-4 text-red-500" />
                <span>PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("PRINT")} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                <Printer className="h-4 w-4 text-blue-500" />
                <span>PRINT</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.("COPY")} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                <Copy className="h-4 w-4 text-slate-500" />
                <span>COPY</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
