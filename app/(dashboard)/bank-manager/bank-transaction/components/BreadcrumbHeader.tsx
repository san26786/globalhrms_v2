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
    <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-base text-[#535768] dark:text-[#aab3c5]">
            <span>Bank Manager</span>
            <ChevronRight size={15} />
            <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">
              Bank Transaction
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Database className="text-[#0b5394] dark:text-[#8cb8f0] h-7 w-7" />
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8]">
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
                className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:shadow-[#e15425]/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Check className="h-5 w-5 stroke-[2.5]" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <CloseIcon className="h-5 w-5 stroke-[2.5]" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Upload className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              onClick={() => setShowExportOptions(!showExportOptions)}
            >
              <LogOut className="h-5 w-5 rotate-90" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
              Export Data
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100 -z-10 translate-y-[1px]" />
            </div>
            {showExportOptions && (
              <div className="absolute right-0 mt-2 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 rounded-xl shadow-lg p-1.5 w-32 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  onClick={() => {
                    onExport?.("CSV");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white w-full text-left border-0 bg-transparent"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("EXCEL");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white w-full text-left border-0 bg-transparent"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  <span>EXCEL</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("PDF");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white w-full text-left border-0 bg-transparent"
                >
                  <FileText className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("PRINT");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white w-full text-left border-0 bg-transparent"
                >
                  <Printer className="h-4 w-4 text-[#0b5394] dark:text-[#8cb8f0]" />
                  <span>PRINT</span>
                </button>
                <button
                  onClick={() => {
                    onExport?.("COPY");
                    setShowExportOptions(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white w-full text-left border-0 bg-transparent"
                >
                  <Copy className="h-4 w-4 text-[#535768] dark:text-[#aab3c5]" />
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
              className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
              className="rounded-full border-rose-200 dark:border-rose-400/30 hover:border-rose-300 dark:hover:border-rose-400/50 bg-white dark:bg-[#111a2e] hover:bg-rose-50 dark:hover:bg-rose-400/10 text-rose-700 dark:text-rose-300 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] text-xs font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-md z-50">
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
