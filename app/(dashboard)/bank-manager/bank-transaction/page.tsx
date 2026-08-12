"use client";

import { useEffect, useState, useMemo } from "react";
import { DataTable } from "./components/bank-transactionTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";
import { getColumns } from "./components/bank-transactionColumns";
import FormSettingsModal, { ColumnSetting } from "./components/FormSettingsModal";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, ArrowUpDown } from "lucide-react";

interface LookupOption {
  label: string;
  value: string;
}

const defaultSettings: ColumnSetting[] = [
  { systemName: "ID", displayName: "Id", visibleInList: true, visibleInForm: true },
  { systemName: "TRANSACTION_DATE", displayName: "Transaction Date", visibleInList: true, visibleInForm: true },
  { systemName: "TRANSACTION_STATUS", displayName: "Transaction Status", visibleInList: true, visibleInForm: true },
  { systemName: "TRANSACTION_STATUS_ID", displayName: "Transaction Status Id", visibleInList: true, visibleInForm: true },
  { systemName: "ACCOUNT_ID", displayName: "Account Id", visibleInList: true, visibleInForm: true },
  { systemName: "PARTICULARS", displayName: "Particulars", visibleInList: true, visibleInForm: true },
  { systemName: "DESCRIPTION", displayName: "Description", visibleInList: true, visibleInForm: true },
  { systemName: "CHQNO_REFNO", displayName: "Cheque Ref No", visibleInList: true, visibleInForm: true },
  { systemName: "DEBIT_AMOUNT", displayName: "Debit Amount", visibleInList: true, visibleInForm: true },
  { systemName: "CREDIT_AMOUNT", displayName: "Credit Amount", visibleInList: true, visibleInForm: true },
  { systemName: "CLOSING_BAL", displayName: "Closing Balance", visibleInList: true, visibleInForm: true },
  { systemName: "SOL", displayName: "SOL", visibleInList: true, visibleInForm: true },
  { systemName: "ACCOUNTING_TRANSACTION_TYPE", displayName: "Transaction Type", visibleInList: true, visibleInForm: true },
];

export default function BankTransactionPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter States
  const [bankAccounts, setBankAccounts] = useState<LookupOption[]>([]);
  const [financialYears, setFinancialYears] = useState<LookupOption[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<LookupOption[]>([]);
  const [months, setMonths] = useState<LookupOption[]>([]);

  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedFy, setSelectedFy] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Load settings from localStorage
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bank_transaction_column_settings");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const hasOldFormat = parsed.some((s: any) => s.systemName === "transaction_status_text");
          if (!hasOldFormat) return parsed;
        } catch (e) {
          console.error("Error parsing settings:", e);
        }
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedAccount, selectedType, selectedFy, selectedMonth]);

  const fetchLookups = async () => {
    try {
      const res = await fetch("/api/bank-transaction/lookup");
      const json = await res.json();
      if (json.success) {
        setBankAccounts(json.bankAccounts || []);
        setFinancialYears(json.financialYears || []);
        setTransactionTypes(json.transactionTypes || []);
        setMonths(json.months || []);
      }
    } catch (error) {
      console.error("Failed to fetch filters lookup data:", error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccount !== "all") params.append("accountId", selectedAccount);
      if (selectedType !== "all") params.append("type", selectedType);
      if (selectedFy !== "all") params.append("fyId", selectedFy);
      if (selectedMonth !== "all") params.append("month", selectedMonth);

      const res = await fetch(`/api/bank-transaction?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
      } else {
        toast.error("Failed to fetch transactions");
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Error loading bank transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedAccount("all");
    setSelectedType("all");
    setSelectedFy("all");
    setSelectedMonth("all");
    toast.success("Filters reset successfully");
  };

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_transaction_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

  // Get table columns definition
  const baseColumns = useMemo(() => getColumns({ onRefresh: fetchTransactions }), []);

  // Filter columns based on column settings
  const dynamicColumns = useMemo(() => {
    const result: any[] = [];
    
    // Always keep select and actions columns
    const selectCol = baseColumns.find(c => c.id === "select");
    if (selectCol) result.push(selectCol);
    
    const actionsCol = baseColumns.find(c => c.id === "actions");
    if (actionsCol) result.push(actionsCol);

    columnSettings.forEach((setting) => {
      if (setting.visibleInList) {
        const col = baseColumns.find(c => (c as any).accessorKey === setting.systemName || c.id === setting.systemName);
        if (col) {
          const isSortable = ["ID", "TRANSACTION_DATE"].includes(setting.systemName);
          const updatedCol = {
            ...col,
            header: ({ column }: any) => {
              if (isSortable) {
                return (
                  <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="font-bold text-slate-700 hover:text-slate-900 flex items-center p-0 hover:bg-transparent"
                  >
                    {setting.displayName}
                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                );
              }
              // If it's a numeric right-aligned column:
              const isNumeric = ["DEBIT_AMOUNT", "CREDIT_AMOUNT", "CLOSING_BAL"].includes(setting.systemName);
              if (isNumeric) {
                return <div className="text-right font-bold text-slate-700">{setting.displayName}</div>;
              }
              return <span className="font-bold text-slate-700">{setting.displayName}</span>;
            }
          };
          result.push(updatedCol);
        }
      }
    });

    return result;
  }, [columnSettings, baseColumns]);

  return (
    <div className="max-w-[96%] mx-auto p-4 space-y-6">
      {/* Breadcrumb Header */}
      <BreadcrumbHeader 
        onRefresh={fetchTransactions}
        onApproveSelected={() => toast.success("Selected transactions explained successfully")}
        onClearSelected={() => toast.success("Selected explanations cleared")}
        onImportClick={() => toast.info("Opening sheet import module...")}
        onExport={() => toast.success("CSV download triggered")}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDeleteSelected={() => toast.warning("Bulk delete is not active")}
      />

      {/* Filters Card */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm text-left">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="h-4.5 w-4.5 text-blue-600" />
          Filter Transactions
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bank Account Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Bank Account</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Select a Bank Account" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-slate-50">All Accounts</SelectItem>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.value} value={account.value} className="hover:bg-slate-50">
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Transaction Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Select Transaction Type" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-slate-50">All Types</SelectItem>
                {transactionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="hover:bg-slate-50">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Financial Year Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Financial Year</label>
            <Select value={selectedFy} onValueChange={setSelectedFy}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Select Financial Year" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-slate-50">All Years</SelectItem>
                {financialYears.map((fy) => (
                  <SelectItem key={fy.value} value={fy.value} className="hover:bg-slate-50">
                    {fy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-slate-100 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-slate-50">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="hover:bg-slate-50">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="h-9 px-4 rounded-xl border-blue-200 text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 font-semibold transition-all duration-200"
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
            <RefreshCw size={20} className="animate-spin text-blue-600" />
            <span className="font-semibold text-xs">Loading transactions list...</span>
          </div>
        ) : (
          <DataTable columns={dynamicColumns} data={transactions} />
        )}
      </div>

      {/* Settings Modal */}
      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
