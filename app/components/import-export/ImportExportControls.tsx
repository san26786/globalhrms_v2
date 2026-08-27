// app/components/import-export/ImportExportControls.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { 
  LogOut, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ChevronRight,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { parseImportFile, FieldMapping } from "@/lib/import-export/importUtils";
import { moduleRegistry } from "@/lib/import-export/ModuleConfig";
import { ExportService, ColumnSetting } from "@/lib/import-export/ExportService";

interface ImportExportControlsProps {
  entity: string;
  title: string;
  filename: string;
  columnSettings: ColumnSetting[];
  data: any[];
  tableRef?: any;
  onSuccess?: () => void;
}

export default function ImportExportControls({
  entity,
  title,
  filename,
  columnSettings,
  data,
  tableRef,
  onSuccess
}: ImportExportControlsProps) {
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "summary">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Parsing & Validation States
  const [totalRows, setTotalRows] = useState(0);
  const [validRowsCount, setValidRowsCount] = useState(0);
  const [invalidRowsCount, setInvalidRowsCount] = useState(0);
  const [previews, setPreviews] = useState<any[]>([]);
  const [rawParsedRows, setRawParsedRows] = useState<any[]>([]);

  // Summary States
  const [summary, setSummary] = useState<{
    inserted: number;
    updated: number;
    failed: number;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown dismiss handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (format: string) => {
    setShowExportOptions(false);
    // Export standard selected data or filtered data
    let exportData = data;
    if (tableRef?.current) {
      const selectedRows = tableRef.current.getSelectedRowModel().rows;
      const filteredRows = tableRef.current.getFilteredRowModel().rows;
      exportData = selectedRows.length > 0 
        ? selectedRows.map((r: any) => r.original)
        : filteredRows.map((r: any) => r.original);
    }

    ExportService.export(
      entity,
      format,
      exportData,
      columnSettings,
      title,
      filename
    );
    toast.success(`${format} export initiated successfully.`);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const processUploadedFile = async (file: File) => {
    const config = moduleRegistry[entity];
    if (!config) {
      toast.error(`Entity config for "${entity}" not found.`);
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      // Map schema columns to field mapper config
      const expectedFields: FieldMapping[] = config.fields.map((f) => ({
        key: fieldToCamelCase(f.key),
        label: f.label
      }));

      // Parse spreadsheet using sheetjs client-side
      const parsedRows = await parseImportFile(file, expectedFields);
      if (parsedRows.length === 0) {
        toast.warning("Selected file does not contain any valid data rows.");
        setIsProcessing(false);
        return;
      }

      setRawParsedRows(parsedRows);

      // Call API preview endpoint to run type casts & database constraint validations
      const res = await fetch("/api/common/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          entity,
          rows: parsedRows
        })
      });

      const result = await res.json();
      if (result.success === false) {
        throw new Error(result.message || "Failed to generate preview.");
      }

      setTotalRows(result.totalRows);
      setValidRowsCount(result.validRowsCount);
      setInvalidRowsCount(result.invalidRowsCount);
      setPreviews(result.previews);
      setImportStep("preview");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to parse import file.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert snake_case DB columns to camelCase object keys
  const fieldToCamelCase = (str: string) => {
    return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  };

  const handleConfirmImport = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/common/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          entity,
          rows: rawParsedRows
        })
      });

      const result = await res.json();
      if (!res.ok || result.success === false) {
        throw new Error(result.message || "Failed to complete import.");
      }

      setSummary({
        inserted: result.inserted,
        updated: result.updated,
        failed: result.failed
      });
      setImportStep("summary");
      toast.success("Data imported successfully!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error inserting data records.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setPreviews([]);
    setRawParsedRows([]);
    setSummary(null);
    setImportStep("upload");
    setIsImportModalOpen(false);
  };

  const config = moduleRegistry[entity];

  return (
    <div className="flex items-center gap-2">
      {/* Dynamic Export Control */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          size="icon"
          title="Export Options"
          className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          onClick={() => setShowExportOptions(!showExportOptions)}
        >
          <LogOut className="h-5 w-5 rotate-90" />
        </Button>

        {showExportOptions && (
          <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 w-36 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
            <button
              onClick={() => handleExport("CSV")}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
            >
              <FileText className="h-4 w-4 text-slate-500" />
              <span>CSV Sheet</span>
            </button>
            <button
              onClick={() => handleExport("EXCEL")}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Excel Workbook</span>
            </button>
            <button
              onClick={() => handleExport("PDF")}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
            >
              <FileText className="h-4 w-4 text-red-500" />
              <span>PDF Document</span>
            </button>
            <button
              onClick={() => handleExport("PRINT")}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
            >
              <Printer className="h-4 w-4 text-blue-500" />
              <span>Print Page</span>
            </button>
            <button
              onClick={() => handleExport("COPY")}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900 w-full text-left border-0 bg-transparent"
            >
              <Copy className="h-4 w-4 text-indigo-500" />
              <span>Copy Clipboard</span>
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Import Control */}
      {config && (
        <Button
          variant="outline"
          size="icon"
          title="Import Excel/CSV"
          className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          onClick={() => setIsImportModalOpen(true)}
        >
          <Upload className="h-5 w-5" />
        </Button>
      )}

      {/* Multi-Step Import Dialog */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => { if (!open) resetModal(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Import Data to {title}
            </DialogTitle>
          </DialogHeader>

          {/* STEP 1: UPLOAD FILE */}
          {importStep === "upload" && (
            <div className="py-6 space-y-4">
              <div 
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/10 rounded-2xl p-10 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-12 w-12 rounded-full bg-blue-50 group-hover:scale-110 transition-transform flex items-center justify-center">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Drag and drop your spreadsheet file here</p>
                  <p className="text-xs text-slate-400 font-medium">Supports CSV or Excel Workbook (.xlsx, .xls)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                <h4 className="text-xs font-bold text-slate-600 mb-2">Expected Column Headers:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {config?.fields.map((f) => (
                    <span 
                      key={f.key} 
                      className={`text-xs px-2.5 py-1 rounded-md font-semibold ${f.required ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-600'}`}
                      title={f.required ? "Required Field" : "Optional Field"}
                    >
                      {f.label}{f.required && " *"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATE */}
          {importStep === "preview" && (
            <div className="py-4 space-y-4">
              {/* Validation Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rows</p>
                    <p className="text-2xl font-black text-slate-800">{totalRows}</p>
                  </div>
                  <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Valid Rows</p>
                    <p className="text-2xl font-black text-emerald-700">{validRowsCount}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${invalidRowsCount > 0 ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${invalidRowsCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>Invalid Rows</p>
                    <p className={`text-2xl font-black ${invalidRowsCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>{invalidRowsCount}</p>
                  </div>
                  <XCircle className={`h-8 w-8 ${invalidRowsCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 font-bold border-b border-slate-100 z-10">
                    <tr>
                      <th className="px-4 py-3 text-center">Row</th>
                      <th className="px-4 py-3">Status</th>
                      {config?.fields.map((f) => (
                        <th key={f.key} className="px-4 py-3">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previews.map((preview) => (
                      <tr 
                        key={preview.rowNumber} 
                        className={`hover:bg-slate-50/50 transition-colors ${preview.status === 'error' ? 'bg-red-50/10' : ''}`}
                      >
                        <td className="px-4 py-2.5 text-center font-bold text-slate-400">{preview.rowNumber}</td>
                        <td className="px-4 py-2.5">
                          {preview.status === "valid" && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                            </span>
                          )}
                          {preview.status === "warning" && (
                            <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold" title="Record already exists and will be updated.">
                              <AlertTriangle className="h-3.5 w-3.5" /> Will Update
                            </span>
                          )}
                          {preview.status === "error" && (
                            <span 
                              className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs font-bold cursor-help"
                              title={preview.errors.join("; ")}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Invalid
                            </span>
                          )}
                        </td>
                        {config?.fields.map((f) => {
                          const val = preview.data[f.key];
                          let displayVal = val !== null && val !== undefined ? String(val) : "-";
                          if (val instanceof Date || (f.type === "date" && val)) {
                            displayVal = new Date(val).toLocaleDateString();
                          }
                          return (
                            <td key={f.key} className="px-4 py-2.5 font-medium truncate max-w-[150px]">
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Show critical errors */}
              {invalidRowsCount > 0 && (
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-700">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold">Please correct the spreadsheet errors before saving</p>
                    <p className="text-xs font-medium text-red-600">The database requires all validation checks to pass. Review row status flags above for details.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SUMMARY */}
          {importStep === "summary" && summary && (
            <div className="py-10 text-center space-y-5 flex flex-col items-center">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800">Data Import Complete</h3>
                <p className="text-sm font-semibold text-slate-400">Your records have been integrated successfully.</p>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-md w-full bg-slate-50 border border-slate-100 rounded-2xl p-6">
                <div>
                  <p className="text-2xl font-black text-blue-600">{summary.inserted}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Inserted</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600">{summary.updated}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Updated</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-500">{summary.failed}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Failed</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            {isProcessing ? (
              <Button disabled className="rounded-xl bg-blue-600 font-bold text-white px-5">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...
              </Button>
            ) : (
              <>
                {importStep === "upload" && (
                  <Button variant="outline" className="rounded-xl font-bold" onClick={resetModal}>
                    Cancel
                  </Button>
                )}
                {importStep === "preview" && (
                  <>
                    <Button variant="outline" className="rounded-xl font-bold" onClick={() => setImportStep("upload")}>
                      Back
                    </Button>
                    <Button 
                      disabled={invalidRowsCount > 0}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
                      onClick={handleConfirmImport}
                    >
                      Confirm Import
                    </Button>
                  </>
                )}
                {importStep === "summary" && (
                  <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5" onClick={resetModal}>
                    Close
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
