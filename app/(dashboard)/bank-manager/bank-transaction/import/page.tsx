"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronRight, Database, X, Upload, Info, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { parseImportFile } from "@/lib/import-export/importUtils";

interface BankAccountOption {
  label: string;
  value: string;
}

interface EmployeeOption {
  EMP_ID: number;
  EMP_NBR: string;
  EMP_NAME: string;
  EMPLST_NM: string;
}

export default function ImportTransactionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lookups & Mappings States
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Form States
  const [requestedBy, setRequestedBy] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  // Import Process States
  const [expectedFields, setExpectedFields] = useState<any[]>([]);
  const [isSingleEntry, setIsSingleEntry] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Load Initial Lookups
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch Bank Accounts and Lookup constants
        const resLookup = await fetch("/api/bank-transaction/lookup");
        const jsonLookup = await resLookup.json();
        if (jsonLookup.success) {
          setBankAccounts(jsonLookup.bankAccounts || []);
        }

        // Fetch Raw Bank Details to map Account ID to Bank Name ID
        const resDetails = await fetch("/api/bank-details");
        const jsonDetails = await resDetails.json();
        if (jsonDetails.data) {
          setBankDetails(jsonDetails.data);
        }

        // Fetch Employees list for 'Requested By'
        const resEmployees = await fetch("/api/employees");
        const jsonEmployees = await resEmployees.json();
        if (jsonEmployees.success) {
          setEmployees(jsonEmployees.data || []);
        }
      } catch (err) {
        console.error("Failed to load lookup configurations:", err);
        toast.error("Failed to load form lookups.");
      } finally {
        setLoadingLookups(false);
      }
    }
    loadData();
  }, []);

  // Resolve and update bank details / statement configurations when account changes
  const handleAccountChange = async (selectedAccountId: string) => {
    setAccountId(selectedAccountId);
    setFile(null);
    setParsedData([]);
    setParseError(null);
    setSuccessCount(null);

    const selectedBank = bankDetails.find((b) => String(b.BANK_ID) === selectedAccountId);
    if (!selectedBank) {
      setBankName("");
      setExpectedFields([]);
      setIsSingleEntry(false);
      return;
    }

    setLoadingConfig(true);
    try {
      const bankNameId = selectedBank.BANK_NAME; // The master bank name ID (e.g. "306")

      // 1. Fetch statement settings
      const mappingsRes = await fetch("/api/bank-statement-setting");
      const mappingsJson = await mappingsRes.json();
      if (!mappingsJson.success || !mappingsJson.data) {
        throw new Error("Failed to load bank statement settings.");
      }

      // Filter settings matching this bank name ID
      const filteredMappings = mappingsJson.data.filter(
        (item: any) => String(item.bankId) === String(bankNameId)
      );

      if (filteredMappings.length === 0) {
        setBankName("Unknown Bank");
        setExpectedFields([]);
        toast.warning("Statement configuration mapping missing for this bank type.");
        return;
      }

      setBankName(filteredMappings[0]?.bankName || "Bank");

      // Check single entry flag
      const singleEntryMapped = filteredMappings.some(
        (item: any) => item.mappedColumn === "VALUE" || item.singleEntryFlag
      );
      setIsSingleEntry(singleEntryMapped);

      // Map to db keys expected by client-side parser
      const DB_TO_PROP_MAP: Record<string, string> = {
        TRANSACTION_DATE: "transaction_date",
        PARTICULARS: "particulars",
        DESCRIPTION: "particulars",
        DEBIT_AMOUNT: "debit_amount",
        CREDIT_AMOUNT: "credit_amount",
        CLOSING_BAL: "closing_bal",
        VALUE: "value",
        CHQNO_REFNO: "chqno_refno",
        SOL: "sol",
      };

      const fieldsList: any[] = [];
      filteredMappings.forEach((mapping: any) => {
        const propKey = DB_TO_PROP_MAP[mapping.mappedColumn];
        if (propKey) {
          fieldsList.push({
            key: propKey,
            label: mapping.csvColumn,
            required: propKey === "transaction_date" || propKey === "particulars" || propKey === "value",
          });
        }
      });

      // Add fallbacks
      if (!fieldsList.some((f) => f.key === "transaction_date")) {
        fieldsList.push({ key: "transaction_date", label: "Transaction Date", required: true });
      }
      if (!fieldsList.some((f) => f.key === "particulars")) {
        fieldsList.push({ key: "particulars", label: "Particulars", required: true });
      }

      setExpectedFields(fieldsList);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load configurations for this account.");
      setBankName("Error loading");
      setExpectedFields([]);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Process and parse file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selectedFile = e.target.files[0];

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx" && extension !== "xls") {
      toast.error("Unsupported file format. Please upload a CSV or Excel file.");
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setSuccessCount(null);

    if (expectedFields.length === 0) {
      setParseError("Statement settings columns missing. Please configure settings first.");
      return;
    }

    try {
      const data = await parseImportFile(selectedFile, expectedFields);
      if (data.length === 0) {
        setParseError("The selected file contains no readable rows.");
      } else {
        setParsedData(data);
      }
    } catch (err: any) {
      console.error(err);
      setParseError(`Failed to parse file: ${err?.message || "Unknown parsing error."}`);
    }
  };

  // Perform bulk import
  const handleImportSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!accountId) {
      toast.error("Please select a bank account.");
      return;
    }
    if (!file || parsedData.length === 0) {
      toast.error("Please upload and parse a valid spreadsheet sheet first.");
      return;
    }

    setImporting(true);
    setSuccessCount(null);

    const parsedUserId = requestedBy ? Number(requestedBy) : 1;

    const mappedRows = parsedData.map((row) => {
      let debitAmount = "0";
      let creditAmount = "0";
      let typeCode = "BTTO";

      if (isSingleEntry) {
        const rawVal = String(row.value || "0").replace(/,/g, "").trim();
        const val = parseFloat(rawVal) || 0;
        if (val < 0) {
          debitAmount = String(Math.abs(val));
          creditAmount = "0";
          typeCode = "BTTO";
        } else {
          creditAmount = String(Math.abs(val));
          debitAmount = "0";
          typeCode = "BTTI";
        }
      } else {
        const rawCr = String(row.credit_amount || "0").replace(/,/g, "").trim();
        const rawDb = String(row.debit_amount || "0").replace(/,/g, "").trim();
        const crVal = parseFloat(rawCr) || 0;
        const dbVal = parseFloat(rawDb) || 0;

        if (crVal > 0) {
          creditAmount = String(crVal);
          debitAmount = "0";
          typeCode = "BTTI";
        } else if (dbVal > 0) {
          debitAmount = String(dbVal);
          creditAmount = "0";
          typeCode = "BTTO";
        }
      }

      return {
        transaction_date: row.transaction_date || new Date().toISOString().split("T")[0],
        particulars: row.particulars || "",
        description: row.particulars || "",
        chqno_refno: String(row.chqno_refno || ""),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        closing_bal: String(row.closing_bal || "0"),
        sol: Number(row.sol || 0),
        accounting_transaction_type: typeCode,
        account_id: Number(accountId),
        user_id: parsedUserId,
      };
    });

    let importedCount = 0;
    for (const record of mappedRows) {
      try {
        const res = await fetch("/api/bank-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        if (res.ok) {
          importedCount++;
        }
      } catch (err) {
        console.error("Failed to import record row:", err);
      }
    }

    setImporting(false);
    setSuccessCount(importedCount);

    if (importedCount > 0) {
      toast.success(`Successfully imported ${importedCount} out of ${mappedRows.length} transactions.`);
      setTimeout(() => {
        router.push("/bank-manager/bank-transaction");
      }, 1500);
    } else {
      toast.error("Failed to import bank transactions. Check server logs.");
    }
  };

  if (loadingLookups) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#535768] dark:text-[#aab3c5] space-y-2">
        <Loader2 className="animate-spin text-[#0b5394] dark:text-[#8cb8f0]" size={24} />
        <span>Loading configurations...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header Card (Matches screenshot layout with breadcrumbs and circular buttons) */}
      <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span>Bank Transaction</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">Import</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-[#0b5394] dark:text-[#8cb8f0] h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8] animate-in fade-in slide-in-from-left-2 duration-200">
                Import Bank Transaction
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Import Button */}
            <Button
              type="button"
              onClick={() => handleImportSubmit()}
              disabled={importing}
              size="icon"
              className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Import"
            >
              {importing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => router.push("/bank-manager/bank-transaction")}
              className="rounded-full border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-[#111a2e] hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Cancel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Form Card (No header ribbon, matches bank-details/add style) */}
      <Card className="rounded-3xl border shadow-sm bg-white dark:bg-[#111a2e] overflow-hidden text-left">
        <form id="import-form" onSubmit={handleImportSubmit}>
          <CardContent className="p-6 space-y-4">
            
            {/* Requested By Field */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end pr-4">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Requested By</label>
              </div>
              <div className="w-3/4">
                <Select value={requestedBy} onValueChange={setRequestedBy}>
                  <SelectTrigger className="w-full sm:w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl max-h-60 overflow-y-auto">
                    {employees.map((emp) => (
                      <SelectItem key={emp.EMP_ID} value={String(emp.EMP_ID)} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                        {`${emp.EMP_NAME} ${emp.EMPLST_NM} (${emp.EMP_NBR})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank Account * Field */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end pr-4">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Bank Account<span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <Select value={accountId} onValueChange={handleAccountChange}>
                  <SelectTrigger className="w-full sm:w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e]">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl max-h-60 overflow-y-auto">
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank Name Field (Readonly) */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end pr-4">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">Bank Name</label>
              </div>
              <div className="w-3/4">
                <Input
                  type="text"
                  disabled
                  value={bankName}
                  placeholder="Select Bank Account first"
                  className="w-full sm:w-1/2 h-10 rounded-xl border-slate-200 dark:border-white/10 bg-[#f6f7f9] dark:bg-[#0e1628] text-[#535768] dark:text-[#aab3c5] font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            {/* Bank Sheet * Field */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 text-end pr-4">
                <label className="text-sm font-semibold text-[#1a1818] dark:text-[#e6e9f0]">
                  Bank Sheet<span className="text-rose-700 dark:text-rose-300"> *</span>
                </label>
              </div>
              <div className="w-3/4">
                <div className="flex items-center gap-3 w-full sm:w-1/2 h-10 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] rounded-xl px-2.5 hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    disabled={!accountId || loadingConfig}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!accountId || loadingConfig}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-0 bg-[#f1f3f8] dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-[#1a1818] dark:text-[#e6e9f0] h-7 px-3 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Choose File
                  </Button>
                  <span className="text-xs text-[#535768] dark:text-[#aab3c5] font-semibold truncate flex-1">
                    {file ? file.name : "No file chosen"}
                  </span>
                </div>
              </div>
            </div>

            {/* Parsing Info / Feedback Logs */}
            {loadingConfig && (
              <div className="flex gap-2 items-center justify-center p-4 text-[#535768] dark:text-[#aab3c5] bg-[#f6f7f9] dark:bg-[#0e1628] rounded-2xl border">
                <Loader2 className="h-5 w-5 animate-spin text-[#0b5394] dark:text-[#8cb8f0]" />
                <span className="text-xs font-semibold">Resolving bank statement configuration...</span>
              </div>
            )}

            {parseError && (
              <div className="bg-rose-50 dark:bg-rose-400/10 border border-rose-200 dark:border-rose-400/30 rounded-2xl p-4 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm font-medium">
                <AlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-800 dark:text-rose-200">File Parsing Error</h4>
                  <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-200 leading-relaxed">{parseError}</p>
                </div>
              </div>
            )}

            {successCount !== null && (
              <div className="bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/30 rounded-2xl p-4 flex items-start gap-3 text-emerald-800 dark:text-emerald-200 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">Import Report</h4>
                  <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    Successfully imported {successCount} bank transactions into the ledger. Redirecting...
                  </p>
                </div>
              </div>
            )}

            {/* Layout Template Column info */}
            {accountId && expectedFields.length > 0 && !loadingConfig && (
              <div className="bg-[#e3edf9] dark:bg-[#16233d] border border-[#0b5394]/20 dark:border-[#8cb8f0]/25 rounded-2xl p-4.5 flex items-start gap-3">
                <Info className="h-5 w-5 text-[#0b5394] dark:text-[#8cb8f0] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-[#083f72] dark:text-[#cfe1fa]">Template Fields Mapping</h4>
                  <p className="text-[11px] text-[#083f72] dark:text-[#cfe1fa] leading-relaxed mt-1 font-medium">
                    Please ensure the sheet contains columns matching either the database columns or the configured header labels:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {expectedFields.map((f) => (
                      <span
                        key={f.key}
                        className="bg-white/80 dark:bg-[#111a2e]/80 border border-[#0b5394]/20 dark:border-[#8cb8f0]/25 text-[#083f72] dark:text-[#cfe1fa] text-[10px] font-semibold px-2 py-0.5 rounded-md font-mono"
                        title={`Database Key: ${f.key}`}
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Buttons Container (Matches legacy layout and alignment with inputs) */}
            <div className="pt-6 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row gap-2">
              <div className="sm:w-1/4"></div>
              <div className="sm:w-3/4 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => handleImportSubmit()}
                  disabled={importing}
                  className="h-10 px-5 rounded-xl bg-[#e15425] hover:bg-[#c2431c] text-white font-semibold gap-1.5 shadow-md shadow-[#e15425]/20 border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Import"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/bank-manager/bank-transaction")}
                  className="h-10 px-5 rounded-xl border-slate-200 dark:border-white/10 hover:bg-[#f1f3f8] dark:hover:bg-white/5 font-semibold text-[#323338] dark:text-[#d5dae4] bg-white dark:bg-[#111a2e] cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>

          </CardContent>
        </form>
      </Card>

      {/* Inline Parsed Table Preview (Rendered as a separate clean card underneath) */}
      {parsedData.length > 0 && (
        <Card className="rounded-3xl border shadow-sm bg-white dark:bg-[#111a2e] overflow-hidden text-left p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1a1818] dark:text-[#f1f3f8]">Parsed Spreadsheet Data Preview</h3>
            <span className="text-[11px] font-semibold bg-[#f1f3f8] dark:bg-white/10 px-2 py-0.5 rounded-md text-[#323338] dark:text-[#d5dae4]">
              {parsedData.length} records ready
            </span>
          </div>
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[35vh] scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f6f7f9] dark:bg-[#0e1628] text-[#535768] dark:text-[#aab3c5] font-semibold border-b uppercase tracking-wider text-[9px] sticky top-0 z-10">
                    <th className="py-2.5 px-4 text-center font-semibold w-12 bg-[#f6f7f9] dark:bg-[#0e1628]">S.No.</th>
                    {expectedFields.map((f) => (
                      <th key={f.key} className="py-2.5 px-3 font-semibold bg-[#f6f7f9] dark:bg-[#0e1628]">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10 text-[#1a1818] dark:text-[#e6e9f0]">
                  {parsedData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5 transition-colors">
                      <td className="py-2 px-4 text-center text-[#535768] dark:text-[#aab3c5] font-semibold">{idx + 1}</td>
                      {expectedFields.map((f) => {
                        const val = row[f.key];
                        return (
                          <td key={f.key} className="py-2 px-3 font-medium text-[#323338] dark:text-[#d5dae4]">
                            {val !== null && val !== undefined ? String(val) : (
                              <span className="text-slate-400 dark:text-slate-500 italic font-normal">empty</span>
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
          {parsedData.length > 100 && (
            <p className="text-[10px] text-[#535768] dark:text-[#aab3c5] text-right font-medium">
              * Showing first 100 records in preview
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
