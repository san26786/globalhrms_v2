import { useState, useRef, useEffect } from "react";
import { 
  ChevronRight, 
  Database, 
  Plus, 
  Check,
  X as CloseIcon,
  Upload,
  RefreshCw,
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

interface BreadcrumbHeaderProps {
  onRefresh?: () => void;
  onApproveSelected?: () => void;
  onClearSelected?: () => void;
  onImportClick?: () => void;
  onExport?: (format: string) => void;
  onOpenSettings?: () => void;
  onDeleteSelected?: () => void;
}

export default function BreadcrumbHeader({ 
  onRefresh, 
  onApproveSelected,
  onClearSelected,
  onImportClick,
  onExport,
  onOpenSettings,
  onDeleteSelected, 
}: BreadcrumbHeaderProps) {
  const [showExportOptions, setShowExportOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-base text-gray-500">
            <span>Bank Manager</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-blue-600">
              Bank Transaction
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-blue-600 h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800">
              Bank Transaction
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Add Button */}
          <div className="relative group">
            <Link href="/bank-manager/bank-transaction/add">
              <Button 
                size="icon" 
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Add New Transaction
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Approve/Check Button */}
          <div className="relative group">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onApproveSelected}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Check className="h-5 w-5 stroke-[2.5]" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Explain Transaction
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Clear/Cancel Button */}
          <div className="relative group">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClearSelected}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <CloseIcon className="h-5 w-5 stroke-[2.5]" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Clear Selected
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Import Button */}
          <div className="relative group">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onImportClick}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Upload className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Import Sheet
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="relative group">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Refresh List
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Export Dropdown Menu */}
          <div className="relative group" ref={dropdownRef}>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              onClick={() => setShowExportOptions(!showExportOptions)}
            >
              <LogOut className="h-5 w-5 rotate-90" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Export Data
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
            {showExportOptions && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 w-32 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  onClick={() => {
                    onExport?.("CSV");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("EXCEL");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>EXCEL</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("PDF");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
                >
                  <FileText className="h-4 w-4 text-red-500" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("PRINT");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
                >
                  <Printer className="h-4 w-4 text-blue-500" />
                  <span>PRINT</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("COPY");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
                >
                  <Copy className="h-4 w-4 text-slate-500" />
                  <span>COPY</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Button */}
          <div className="relative group">
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenSettings}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Form Settings
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>

          {/* Delete Selected Button */}
          <div className="relative group">
            <Button
              variant="outline"
              size="icon"
              onClick={onDeleteSelected}
              className="rounded-full border-red-100 hover:border-red-200 bg-white hover:bg-red-50 text-red-500 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white border border-slate-100 text-slate-700 text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Delete Selected
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
