"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "./components/bank-transactionTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";
import { getColumns } from "./components/bank-transactionColumns";
import FormSettingsModal, { ColumnSetting } from "./components/FormSettingsModal";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RefreshCw, Filter, ArrowUpDown } from "lucide-react";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  printData,
  copyToClipboard,
} from "@/lib/import-export/exportUtils";

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
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const tableRef = useRef<any>(null);

  // Filter States
  const [bankAccounts, setBankAccounts] = useState<LookupOption[]>([]);
  const [financialYears, setFinancialYears] = useState<LookupOption[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<LookupOption[]>([]);
  const [months, setMonths] = useState<LookupOption[]>([]);

  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedFy, setSelectedFy] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

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

  const handleApproveSelected = async () => {
    if (!tableRef.current) return;
    const selectedRows = tableRef.current.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      setIsWarningModalOpen(true);
      return;
    }

    const ids = selectedRows.map((r: any) => r.original.ID);
    setBulkActionLoading(true);
    try {
      let successCount = 0;
      for (const id of ids) {
        const res = await fetch(`/api/bank-transaction/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_status: 2 }), // 2 = Explained
        });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        toast.success(`Successfully explained ${successCount} transactions`);
        tableRef.current.resetRowSelection();
        fetchTransactions();
      } else {
        toast.error("Failed to explain selected transactions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error explaining selected transactions");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleClearSelected = async () => {
    if (!tableRef.current) return;
    const selectedRows = tableRef.current.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      setIsWarningModalOpen(true);
      return;
    }

    const ids = selectedRows.map((r: any) => r.original.ID);
    setBulkActionLoading(true);
    try {
      let successCount = 0;
      for (const id of ids) {
        const res = await fetch(`/api/bank-transaction/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_status: 1 }), // 1 = Unexplained/Pending
        });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        toast.success(`Successfully cleared status for ${successCount} transactions`);
        tableRef.current.resetRowSelection();
        fetchTransactions();
      } else {
        toast.error("Failed to clear selected transactions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error clearing selected transactions");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!tableRef.current) return;
    const selectedRows = tableRef.current.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      setIsWarningModalOpen(true);
      return;
    }

    const ids = selectedRows.map((r: any) => r.original.ID);
    if (!confirm(`Are you sure you want to delete ${ids.length} selected transactions?`)) return;

    setBulkActionLoading(true);
    try {
      let successCount = 0;
      for (const id of ids) {
        const res = await fetch(`/api/bank-transaction/${id}`, {
          method: "DELETE",
        });
        if (res.ok) successCount++;
      }
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} transactions`);
        tableRef.current.resetRowSelection();
        fetchTransactions();
      } else {
        toast.error("Failed to delete selected transactions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting selected transactions");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExport = (format: string) => {
    if (!tableRef.current) return;

    const visibleColumns = columnSettings.filter((c) => c.visibleInList);
    const headers = visibleColumns.map((c) => c.displayName);
    const keys = visibleColumns.map((c) => c.systemName);

    const selectedRows = tableRef.current.getSelectedRowModel().rows;
    const filteredRows = tableRef.current.getFilteredRowModel().rows;

    const dataToExport = selectedRows.length > 0
      ? selectedRows.map((r: any) => r.original)
      : filteredRows.map((r: any) => r.original);

    const filename = `BankTransactions_${new Date().toISOString().slice(0, 10)}`;

    switch (format.toUpperCase()) {
      case "CSV":
        exportToCSV(headers, keys, dataToExport, filename);
        toast.success("CSV export initiated");
        break;
      case "EXCEL":
        exportToExcel(headers, keys, dataToExport, filename);
        toast.success("Excel export initiated");
        break;
      case "PDF":
        exportToPDF("Bank Transactions List", headers, keys, dataToExport, filename);
        toast.success("PDF export initiated");
        break;
      case "PRINT":
        printData("Bank Transactions List", headers, keys, dataToExport);
        break;
      case "COPY":
        copyToClipboard(headers, keys, dataToExport).then((success) => {
          if (success) {
            toast.success("Table data copied to clipboard");
          } else {
            toast.error("Failed to copy table data");
          }
        });
        break;
      default:
        toast.error("Unknown export format");
    }
  };

  const handleImportClick = () => {
    router.push("/bank-manager/bank-transaction/import");
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
                    className="font-semibold text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white flex items-center p-0 hover:bg-transparent"
                  >
                    {setting.displayName}
                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-[#535768] dark:text-[#aab3c5]" />
                  </Button>
                );
              }
              // If it's a numeric right-aligned column:
              const isNumeric = ["DEBIT_AMOUNT", "CREDIT_AMOUNT", "CLOSING_BAL"].includes(setting.systemName);
              if (isNumeric) {
                return <div className="text-right font-semibold text-[#1a1818] dark:text-[#e6e9f0]">{setting.displayName}</div>;
              }
              return <span className="font-semibold text-[#1a1818] dark:text-[#e6e9f0]">{setting.displayName}</span>;
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
        onApproveSelected={handleApproveSelected}
        onClearSelected={handleClearSelected}
        onImportClick={handleImportClick}
        onExport={handleExport}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onDeleteSelected={handleBulkDelete}
      />

      {/* Filters Card */}
      <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm text-left">
        <h2 className="text-sm font-semibold text-[#1a1818] dark:text-[#f1f3f8] mb-4 flex items-center gap-2">
          <Filter className="h-4.5 w-4.5 text-[#0b5394] dark:text-[#8cb8f0]" />
          Filter Transactions
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bank Account Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#535768] dark:text-[#aab3c5]">Bank Account</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-white/10">
                <SelectValue placeholder="Select a Bank Account" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">All Accounts</SelectItem>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.value} value={account.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Type Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#535768] dark:text-[#aab3c5]">Transaction Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-white/10">
                <SelectValue placeholder="Select Transaction Type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">All Types</SelectItem>
                {transactionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Financial Year Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#535768] dark:text-[#aab3c5]">Financial Year</label>
            <Select value={selectedFy} onValueChange={setSelectedFy}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-white/10">
                <SelectValue placeholder="Select Financial Year" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">All Years</SelectItem>
                {financialYears.map((fy) => (
                  <SelectItem key={fy.value} value={fy.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
                    {fy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#535768] dark:text-[#aab3c5]">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-white/10">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-md rounded-xl">
                <SelectItem value="all" className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5">
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
            className="h-9 px-4 rounded-xl border-[#0b5394]/25 dark:border-[#8cb8f0]/30 text-[#0b5394] dark:text-[#8cb8f0] hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] font-semibold transition-all duration-200"
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#535768] dark:text-[#aab3c5] space-y-2">
            <RefreshCw size={20} className="animate-spin text-[#0b5394] dark:text-[#8cb8f0]" />
            <span className="font-semibold text-xs">Loading transactions list...</span>
          </div>
        ) : (
          <DataTable 
            columns={dynamicColumns} 
            data={transactions} 
            onTableInstance={(instance) => { tableRef.current = instance; }}
          />
        )}
      </div>

      {/* Settings Modal */}
      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />

      {/* Warning Modal */}
      <Dialog open={isWarningModalOpen} onOpenChange={setIsWarningModalOpen}>
        <DialogContent className="max-w-[450px] p-8 rounded-lg bg-white dark:bg-[#111a2e] border border-slate-100 dark:border-white/10 shadow-2xl flex flex-col items-center justify-center gap-6 focus:outline-none select-none">
          <div className="flex items-center justify-center h-20 w-20 rounded-full border-4 border-[#f8bb86] text-[#f8bb86] bg-transparent">
            <span className="text-5xl font-light font-sans leading-none -translate-y-[2px]">!</span>
          </div>
          <h2 className="text-[18px] font-normal text-[#595959] text-center leading-normal">
            Please select record(s)
          </h2>
          <div className="mt-2 w-full flex justify-center">
            <button
              onClick={() => setIsWarningModalOpen(false)}
              className="px-8 py-2 bg-[#e15425] hover:bg-[#c2431c] text-white font-semibold rounded-lg text-sm shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:shadow-[#e15425]/40 active:scale-95 transition-all duration-200 cursor-pointer border-0"
            >
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
