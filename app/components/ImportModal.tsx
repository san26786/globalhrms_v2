// app/components/ImportModal.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseImportFile, FieldMapping } from "@/lib/import-export/importUtils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expectedFields: FieldMapping[];
  onConfirmImport: (data: any[]) => Promise<{ success: boolean; count?: number; message?: string }>;
  bankAccountLabel?: string;
  bankName?: string;
  bankAccounts?: { label: string; value: string }[];
  onBankAccountSelect?: (accountId: string) => Promise<{ expectedFields: FieldMapping[]; bankName: string; isSingleEntry: boolean }>;
}

type ImportStep = "upload" | "preview" | "importing" | "result";

export default function ImportModal({
  isOpen,
  onClose,
  title,
  expectedFields,
  onConfirmImport,
  bankAccountLabel,
  bankName,
  bankAccounts,
  onBankAccountSelect,
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; message: string } | null>(null);

  const [selectedAccId, setSelectedAccId] = useState<string>("");
  const [resolvedBankName, setResolvedBankName] = useState<string>(bankName || "");
  const [resolvedExpectedFields, setResolvedExpectedFields] = useState<FieldMapping[]>(expectedFields);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAccId("");
      setResolvedBankName(bankName || "");
      setResolvedExpectedFields(expectedFields);
      setFile(null);
      setParsedData([]);
      setErrorMsg(null);
      setResultMsg(null);
      setStep("upload");
    }
  }, [isOpen, bankName, expectedFields]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBankAccountChange = async (accountId: string) => {
    setSelectedAccId(accountId);
    if (!onBankAccountSelect) return;
    
    setLoadingConfig(true);
    setErrorMsg(null);
    try {
      const config = await onBankAccountSelect(accountId);
      setResolvedBankName(config.bankName);
      setResolvedExpectedFields(config.expectedFields);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load mappings for the selected bank account.");
      setErrorMsg(`Failed to load bank settings: ${err?.message || "Unknown error"}`);
    } finally {
      setLoadingConfig(false);
    }
  };

  const processFile = async (selectedFile: File) => {
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx" && extension !== "xls") {
      toast.error("Unsupported file format. Please upload a CSV or Excel file.");
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await parseImportFile(selectedFile, resolvedExpectedFields);
      if (data.length === 0) {
        setErrorMsg("The selected file contains no readable records.");
        setStep("upload");
      } else {
        setParsedData(data);
        setStep("preview");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to parse file: ${err?.message || "Unknown error"}`);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleConfirm = async () => {
    setLoading(true);
    setStep("importing");
    try {
      const res = await onConfirmImport(parsedData);
      setResultMsg({
        success: res.success,
        message: res.message || (res.success 
          ? `Successfully imported ${res.count ?? parsedData.length} records.`
          : "Failed to import records.")
      });
      setStep("result");
    } catch (err: any) {
      setResultMsg({
        success: false,
        message: err?.message || "An unexpected error occurred during import."
      });
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setErrorMsg(null);
    setResultMsg(null);
    setStep("upload");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-white text-slate-800 px-6 py-4.5 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-bold tracking-tight text-slate-800">Import Data: {title}</h2>
              <span className="text-xs text-slate-400 mt-0.5 font-medium">Upload Excel or CSV spreadsheet to bulk insert records</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={step === "importing"}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-sm font-medium">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800">Parsing Error</h4>
                <p className="mt-0.5 text-xs text-red-700/90 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: Upload Dropzone */}
          {step === "upload" && (
            <div className="space-y-4">
              {(bankAccountLabel || resolvedBankName) && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  {bankAccountLabel && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Account</span>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">{bankAccountLabel}</p>
                    </div>
                  )}
                  {resolvedBankName && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Name</span>
                      <p className="text-sm font-bold text-slate-700 mt-0.5">{resolvedBankName}</p>
                    </div>
                  )}
                </div>
              )}

              {!bankAccountLabel && bankAccounts && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Bank Account <span className="text-red-500">*</span></label>
                      <Select value={selectedAccId} onValueChange={handleBankAccountChange}>
                        <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Select a Bank Account" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.value} value={account.value} className="hover:bg-slate-50">
                              {account.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Bank Name</label>
                      <Input
                        type="text"
                        disabled
                        value={resolvedBankName}
                        placeholder="Select Bank Account first"
                        className="w-full h-10 rounded-xl border-slate-200 bg-slate-100 text-slate-500 font-semibold cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(bankAccountLabel || selectedAccId || !bankAccounts) ? (
                <>
                  {loadingConfig ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2 bg-white rounded-3xl border border-dashed border-slate-200">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <span className="text-xs font-semibold">Resolving statement settings...</span>
                    </div>
                  ) : (
                    <>
                      <div 
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={triggerFileSelect}
                        className="border-2 border-dashed border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group"
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept=".csv,.xlsx,.xls"
                          className="hidden" 
                        />
                        <div className="w-14 h-14 rounded-full bg-slate-50 group-hover:bg-blue-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all mb-4">
                          {loading ? (
                            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                          ) : (
                            <Upload className="h-7 w-7 transition-transform group-hover:-translate-y-0.5" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">
                          {loading ? "Reading spreadsheet..." : "Drag & drop spreadsheet here"}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-medium">
                          Supports CSV, Microsoft Excel (.xlsx, .xls) files.
                        </p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          disabled={loading}
                          className="mt-6 border-slate-200 text-slate-600 bg-white group-hover:border-blue-200 group-hover:bg-white rounded-full font-bold shadow-sm text-xs px-5 h-9"
                        >
                          Choose File
                        </Button>
                      </div>

                      {/* Template fields instructions */}
                      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4.5 flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-blue-800">Template Fields Mapping</h4>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-1 font-medium">
                            Your spreadsheet headers should contain names matching either the Database Name or the display label. The columns can be in any order. Supported columns:
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {resolvedExpectedFields.map(f => (
                              <span key={f.key} className="bg-white/80 border border-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-md font-mono" title={`Database Key: ${f.key}`}>
                                {f.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="bg-blue-50/20 border border-blue-100/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                  <Info className="h-8 w-8 text-blue-500 mb-2" />
                  <h4 className="text-sm font-bold text-slate-800">Select a Bank Account</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed font-medium">
                    Please select a Bank Account above to load statement configurations and proceed with CSV upload.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview parsed records */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm shrink-0">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 truncate max-w-xs">{file?.name}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      {parsedData.length} records found
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={handleReset} 
                  variant="outline" 
                  className="text-xs h-8.5 rounded-full border-slate-200 text-slate-500 hover:text-slate-700"
                >
                  Clear and Upload Another
                </Button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh] scrollbar-thin scrollbar-thumb-slate-200">
                  <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px] sticky top-0 z-10">
                        <th className="py-3 px-5 text-center font-bold w-12 bg-slate-50">S.No.</th>
                        {resolvedExpectedFields.map(f => (
                          <th key={f.key} className="py-3 px-4 font-bold bg-slate-50">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {parsedData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-2.5 px-5 text-center text-slate-400 font-bold">{idx + 1}</td>
                          {resolvedExpectedFields.map(f => {
                            const val = row[f.key];
                            return (
                              <td key={f.key} className="py-2.5 px-4 font-medium text-slate-600">
                                {val !== null && val !== undefined ? String(val) : (
                                  <span className="text-slate-300 italic font-normal">empty</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Importing loader */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              <h3 className="text-sm font-bold text-slate-800">Importing records into database...</h3>
              <p className="text-xs text-slate-400 font-medium">Please do not close this window or navigate away.</p>
            </div>
          )}

          {/* STEP 4: Results */}
          {step === "result" && resultMsg && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${
                resultMsg.success ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}>
                {resultMsg.success ? (
                  <CheckCircle2 className="h-9 w-9" />
                ) : (
                  <AlertCircle className="h-9 w-9" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {resultMsg.success ? "Import Completed Successfully" : "Import Failed"}
              </h3>
              <p className={`text-xs mt-2 max-w-md leading-relaxed font-semibold ${
                resultMsg.success ? "text-slate-500" : "text-red-600"
              }`}>
                {resultMsg.message}
              </p>
              <div className="mt-8 flex justify-center gap-3">
                {resultMsg.success ? (
                  <Button 
                    onClick={onClose} 
                    className="!bg-none !bg-blue-600 hover:!bg-blue-700 text-white font-semibold px-6 h-10 rounded-full shadow-md transition-all duration-200 active:scale-95 border-0"
                  >
                    Close Window
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleReset} 
                      className="!bg-none !bg-blue-600 hover:!bg-blue-700 text-white font-semibold px-6 h-10 rounded-full shadow-md transition-all duration-200 active:scale-95 border-0"
                    >
                      Try Again
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={onClose} 
                      className="border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 font-semibold px-5 h-10 rounded-full transition-all duration-200 active:scale-95"
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {step !== "importing" && step !== "result" && (
          <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 font-semibold px-5 h-10 rounded-full transition-all duration-200 active:scale-95"
            >
              Cancel
            </Button>
            {step === "preview" && (
              <Button
                type="button"
                onClick={handleConfirm}
                className="!bg-none !bg-blue-600 hover:!bg-blue-700 text-white font-semibold px-6 h-10 rounded-full shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 transition-all duration-200 active:scale-95 border-0"
              >
                Import {parsedData.length} Records
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
