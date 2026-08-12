"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Database,
  Plus,
  Trash2,
  UploadCloud,
  X,
  Sliders,
  CheckCircle2,
  Save,
  Loader2,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface MappingRow {
  csvColumn: string;
  dbColumn: string;
  anotherDbColumn?: string;
  crdbFlag: boolean;
}

export default function EditStatementSettingPage({
  params: paramsPromise
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bankIdStr = params.id;

  // Lookup Options
  const [bankNames, setBankNames] = useState<{ label: string; value: string }[]>([]);
  const [dbFields, setDbFields] = useState<string[]>([]);
  const [requestedByOptions, setRequestedByOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [requestedBy, setRequestedBy] = useState<string>("");
  const [singleEntryFlag, setSingleEntryFlag] = useState<boolean>(false);
  const [mappings, setMappings] = useState<MappingRow[]>([
    { csvColumn: "", dbColumn: "", crdbFlag: false }
  ]);
  
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  // Bank name derived from bankNames list
  const currentBankName = bankNames.find((b) => b.value === bankIdStr)?.label || `Bank (ID: ${bankIdStr})`;

  useEffect(() => {
    async function loadData() {
      try {
        // Load options
        const resLookup = await fetch("/api/bank-statement-setting/lookup");
        const jsonLookup = await resLookup.json();
        if (jsonLookup.success) {
          setBankNames(jsonLookup.bankNames || []);
          setDbFields(jsonLookup.dbFields || []);
          setRequestedByOptions(jsonLookup.requestedByOptions || []);
        }

        // Load existing settings
        const resDetails = await fetch(`/api/bank-statement-setting/${bankIdStr}`);
        const jsonDetails = await resDetails.json();
        if (jsonDetails.success && jsonDetails.data) {
          setSingleEntryFlag(jsonDetails.data.singleEntryFlag || false);
          setRequestedBy(jsonDetails.data.requestedBy || "");
          
          const rawMappings = jsonDetails.data.mappings || [];
          if (rawMappings.length > 0) {
            setMappings(rawMappings.map((m: any) => ({
              csvColumn: m.csvColumn,
              dbColumn: m.dbColumn,
              anotherDbColumn: m.anotherDbColumn || "",
              crdbFlag: m.crdbFlag || false
            })));
          }
        }
      } catch (err) {
        console.error("Failed to load bank settings details:", err);
        toast.error("Failed to load settings details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [bankIdStr]);

  // Fuzzy match CSV headers to db fields
  const autoMatch = (csvHeader: string, fields: string[]): string => {
    const clean = csvHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) return "";

    for (const field of fields) {
      const fieldClean = field.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean === fieldClean || fieldClean.includes(clean) || clean.includes(fieldClean)) {
        return field;
      }
    }

    if (clean.includes("date")) return "TRANSACTION_DATE";
    if (
      clean.includes("particular") ||
      clean.includes("narration") ||
      clean.includes("remark") ||
      clean.includes("description")
    )
      return "PARTICULARS";
    if (clean.includes("chq") || clean.includes("ref") || clean.includes("cheque"))
      return "CHQNO_REFNO";
    if (clean.includes("credit") || clean.includes("deposit") || clean.includes("incoming") || clean.includes("received"))
      return "CREDIT_AMOUNT";
    if (clean.includes("debit") || clean.includes("withdrawal") || clean.includes("outgoing") || clean.includes("payment"))
      return "DEBIT_AMOUNT";
    if (clean.includes("balance")) return "CLOSING_BAL";

    return "";
  };

  // Handle local CSV file upload to parse headers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const firstLine = text.split("\n")[0];
      const headers = firstLine
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""))
        .filter((h) => h.length > 0);

      if (headers.length === 0) {
        toast.error("Could not read headers from the CSV file.");
        return;
      }

      // Generate mappings automatically
      const autoMappings = headers.map((header) => {
        const matchedField = autoMatch(header, dbFields);
        return {
          csvColumn: header,
          dbColumn: matchedField,
          crdbFlag: matchedField === "CREDIT_AMOUNT" || matchedField === "DEBIT_AMOUNT"
        };
      });

      setMappings(autoMappings);
      toast.success(`Successfully parsed and auto-mapped ${headers.length} columns from ${file.name}!`);
    };
    reader.readAsText(file);
  };

  const addMappingRow = () => {
    setMappings([...mappings, { csvColumn: "", dbColumn: "", crdbFlag: false }]);
  };

  const removeMappingRow = (index: number) => {
    if (mappings.length === 1) {
      setMappings([{ csvColumn: "", dbColumn: "", crdbFlag: false }]);
    } else {
      setMappings(mappings.filter((_, i) => i !== index));
    }
  };

  const updateMappingRow = (index: number, field: keyof MappingRow, value: any) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validMappings = mappings.filter((m) => m.csvColumn && m.dbColumn);
    if (validMappings.length === 0) {
      toast.error("Please add at least one column mapping");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/bank-statement-setting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: bankIdStr,
          singleEntryFlag,
          mappings: validMappings,
          requestedBy
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Bank statement settings updated successfully");
        router.push("/bank-manager/bank-statement-setting");
      } else {
        toast.error(json.message || "Failed to update settings");
      }
    } catch (err) {
      console.error("Failed to submit settings:", err);
      toast.error("Failed to update bank statement settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center py-40 gap-3">
        <div className="h-10 w-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-400">Loading statement settings data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 text-left max-w-5xl">
      {/* Header Panel (BreadcrumbHeader Design) */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span>Bank Statement Setting</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Edit</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Edit Bank Statement Setting
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              size="icon"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Link href="/bank-manager/bank-statement-setting">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Form wrapped in Card & CardFooter */}
      <Card className="rounded-3xl border shadow-sm bg-white overflow-hidden text-left">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            
            {/* Requested By Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Requested By
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Select value={requestedBy} onValueChange={setRequestedBy}>
                  <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-100 rounded-xl shadow-lg max-h-60 overflow-y-auto z-[101]">
                    {requestedByOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="hover:bg-slate-50">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank Name Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Bank Name
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Input
                  type="text"
                  disabled
                  value={currentBankName}
                  className="h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-500 font-bold cursor-not-allowed"
                />
              </div>
            </div>

            {/* Single Entry Flag Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Single Entry Flag
                </label>
              </div>
              <div className="w-3/4 space-y-0 flex items-center justify-start">
                <Switch
                  checked={singleEntryFlag}
                  onCheckedChange={setSingleEntryFlag}
                />
              </div>
            </div>

            {/* Upload CSV File Row */}
            <div className="flex gap-2 items-start">
              <div className="w-1/4 space-y-0 text-end pt-2">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Upload CSV File
                </label>
              </div>
              <div className="w-3/4 space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/10 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 group"
                >
                  <UploadCloud className="h-8 w-8 text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-200" />
                  <div className="text-center">
                    <span className="text-xs font-bold text-slate-700 block">
                      {fileName ? fileName : "Upload New CSV Statement"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Click to select files</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {fileName && (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 text-xs font-bold p-2.5 rounded-xl border border-emerald-100 w-fit">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">Auto-mapped headers from file</span>
                  </div>
                )}
              </div>
            </div>

            {/* Configure Mapping Section */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-2">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                  Configure CSV to DB Mapping
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addMappingRow}
                  className="rounded-full border-blue-200 text-blue-600 hover:bg-blue-50/50 h-9 px-3 gap-1 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
              </div>

              <div className="space-y-3">
                {mappings.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center group bg-slate-50/30 p-3 rounded-2xl border border-slate-50 hover:bg-slate-50/60 hover:border-slate-100 transition-all">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider md:hidden">CSV Column Name</label>
                      <Input
                        type="text"
                        placeholder="CSV Column (e.g. Transaction Date)"
                        value={row.csvColumn}
                        onChange={(e) => updateMappingRow(index, "csvColumn", e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-white"
                      />
                    </div>

                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider md:hidden">DB Column Name</label>
                      <Select
                        value={row.dbColumn}
                        onValueChange={(val) => updateMappingRow(index, "dbColumn", val)}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Select DB Field" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-slate-100 rounded-xl max-h-60 overflow-y-auto shadow-lg">
                          {dbFields.map((field) => (
                            <SelectItem key={field} value={field} className="hover:bg-slate-50">
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 md:hidden">CRDB Flag</span>
                      <div className="flex items-center gap-1.5" title="Check if this field indicates Credit/Debit amount">
                        <Switch
                          checked={row.crdbFlag}
                          onCheckedChange={(val) => updateMappingRow(index, "crdbFlag", val)}
                        />
                        <span className="text-[10px] font-bold text-slate-400">CRDB</span>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMappingRow(index)}
                        className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </CardContent>

          {/* Bottom CardFooter actions shading */}
          <CardFooter className="flex items-center gap-2 pt-4 border-t border-slate-100 px-6 pb-6 bg-slate-50/50">
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-md shadow-blue-200/50 border-0 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>

            <Link href="/bank-manager/bank-statement-setting">
              <Button type="button" variant="outline" className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-100/50 font-bold text-slate-600 bg-white cursor-pointer">
                Cancel
              </Button>
            </Link>
          </CardFooter>

        </form>
      </Card>
    </div>
  );
}
