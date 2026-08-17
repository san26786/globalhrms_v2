"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "./components/bank-statement-settingTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";
import FormSettingsModal, { ColumnSetting } from "./components/FormSettingsModal";

interface StatementSetting {
  id: number;
  bankId: number;
  bankName: string;
  csvColumn: string;
  mappedColumn: string;
  anotherMappedColumn: string;
  crdbFlag: boolean;
  singleEntryFlag: boolean;
}

const defaultSettings: ColumnSetting[] = [
  { systemName: "bankName", displayName: "Bank Name", visibleInList: true, visibleInForm: true },
  { systemName: "csvColumn", displayName: "CSV Column", visibleInList: true, visibleInForm: true },
  { systemName: "mappedColumn", displayName: "Mapped Column", visibleInList: true, visibleInForm: true },
  { systemName: "crdbFlag", displayName: "CRDB Flag", visibleInList: true, visibleInForm: true }
];

export default function BankStatementSettingPage() {
  const [settingsList, setSettingsList] = useState<StatementSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Table States
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bank_statement_column_settings");
      if (stored) return JSON.parse(stored);
    }
    return defaultSettings;
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-statement-setting");
      const json = await res.json();
      if (json.success) {
        setSettingsList(json.data || []);
      } else {
        toast.error("Failed to load settings");
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
      toast.error("Error loading statement settings");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, bankName: string, csvCol: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete the mapping for CSV Column "${csvCol}" under ${bankName}?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/bank-statement-setting/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete setting mapping");

      toast.success("Mapping deleted successfully");
      fetchSettings();
    } catch (error) {
      console.error("Error deleting mapping:", error);
      toast.error("Error deleting setting mapping");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIndices = Object.keys(rowSelection).map((k) => parseInt(k));
    if (selectedIndices.length === 0) {
      toast.warning("Please select at least one record to delete");
      return;
    }

    const selectedItems = selectedIndices.map((index) => settingsList[index]).filter(Boolean);
    if (!confirm(`Are you sure you want to delete the mapping rules for ${selectedItems.length} selected row(s)?`)) return;

    let successCount = 0;
    for (const item of selectedItems) {
      try {
        const res = await fetch(`/api/bank-statement-setting/${item.id}`, { method: "DELETE" });
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} column mapping rules.`);
      setRowSelection({});
      fetchSettings();
    } else {
      toast.error("Failed to delete selected mappings.");
    }
  };

  const handleExport = (format: string) => {
    toast.info(`Exporting as ${format}...`);
  };

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_statement_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

  // Define table columns
  const columns = useMemo<ColumnDef<StatementSetting>[]>(() => {
    const result: ColumnDef<StatementSetting>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "sr_no",
        header: () => <span className="font-bold text-slate-700">S.No.</span>,
        cell: ({ row }) => <span className="text-slate-500 font-medium">{row.index + 1}</span>,
      },
      {
        accessorKey: "Actions",
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                onClick={() => router.push(`/bank-manager/bank-statement-setting/edit/${item.bankId}`)}
                title="Edit Settings for this Bank"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                onClick={() => handleDelete(item.id, item.bankName, item.csvColumn)}
                title="Delete Mapping"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      }
    ];

    columnSettings.forEach((setting) => {
      if (setting.visibleInList) {
        if (setting.systemName === "bankName") {
          result.push({
            accessorKey: "bankName",
            id: "bankName",
            header: ({ column }) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="font-bold text-slate-700 hover:text-slate-900 flex items-center p-0 hover:bg-transparent"
              >
                {setting.displayName}
                <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            ),
            cell: ({ row }) => {
              const item = row.original;
              return (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{item.bankName}</span>
                  {item.singleEntryFlag && (
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full border border-emerald-100/50">
                      Single Entry
                    </span>
                  )}
                </div>
              );
            },
          });
        } else if (setting.systemName === "csvColumn") {
          result.push({
            accessorKey: "csvColumn",
            id: "csvColumn",
            header: ({ column }) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="font-bold text-slate-700 hover:text-slate-900 flex items-center p-0 hover:bg-transparent"
              >
                {setting.displayName}
                <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            ),
            cell: ({ row }) => (
              <span className="text-slate-600 font-semibold font-sans">{row.original.csvColumn}</span>
            ),
          });
        } else if (setting.systemName === "mappedColumn") {
          result.push({
            accessorKey: "mappedColumn",
            id: "mappedColumn",
            header: ({ column }) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="font-bold text-slate-700 hover:text-slate-900 flex items-center p-0 hover:bg-transparent"
              >
                {setting.displayName}
                <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            ),
            cell: ({ row }) => (
              <span className="text-slate-600 font-semibold font-mono text-xs">{row.original.mappedColumn}</span>
            ),
          });
        } else if (setting.systemName === "crdbFlag") {
          result.push({
            accessorKey: "crdbFlag",
            id: "crdbFlag",
            header: ({ column }) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="font-bold text-slate-700 hover:text-slate-900 flex items-center p-0 hover:bg-transparent"
              >
                {setting.displayName}
                <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            ),
            cell: ({ row }) => (
              <span className="text-slate-600 font-bold">{row.original.crdbFlag ? "1" : "0"}</span>
            ),
          });
        }
      }
    });

    return result;
  }, [router, columnSettings]);

  return (
    <div className="max-w-[96%] mx-auto p-4 space-y-6">
      <BreadcrumbHeader 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onDeleteSelected={handleBulkDelete}
        onExport={handleExport}
      />
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-sm font-semibold text-slate-400">Loading statement settings...</p>
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={settingsList} 
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
          sorting={sorting}
          setSorting={setSorting}
        />
      )}

      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
