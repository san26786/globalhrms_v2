"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { DataTable } from "./components/bank-name-masterTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";
import FormSettingsModal, { ColumnSetting } from "./components/FormSettingsModal";

interface BankNameRecord {
  MSTR_ID: number;
  MSTR_CD: string;
  MSTR_NM: string;
  MSTR_DESC: string | null;
  IS_PREDEFINED?: number;
  USER_CAN_CREATE_DATA_?: number;
  USER_CAN_EDIT_DATA_NM?: number;
  OA_BRAND_CD?: string | null;
  APP_CD?: string | null;
  IS_DEFAULT_FOR_SYNC?: number;
}

const defaultSettings: ColumnSetting[] = [
  { systemName: "MSTR_CD", displayName: "Menu Code", visibleInList: true, visibleInForm: true },
  { systemName: "MSTR_NM", displayName: "Menu Name", visibleInList: true, visibleInForm: true },
  { systemName: "IS_PREDEFINED", displayName: "Is Predefined", visibleInList: false, visibleInForm: false },
  { systemName: "USER_CAN_CREATE_DATA_", displayName: "User Can Create Data", visibleInList: false, visibleInForm: false },
  { systemName: "USER_CAN_EDIT_DATA_NM", displayName: "User Can Edit Data Name", visibleInList: false, visibleInForm: false },
  { systemName: "MSTR_DESC", displayName: "Description", visibleInList: true, visibleInForm: true },
  { systemName: "OA_BRAND_CD", displayName: "Brand", visibleInList: false, visibleInForm: false },
  { systemName: "APP_CD", displayName: "App Code", visibleInList: false, visibleInForm: false },
  { systemName: "IS_DEFAULT_FOR_SYNC", displayName: "Is Delete For Sync", visibleInList: false, visibleInForm: false }
];

export default function BankNameMasterPage() {
  const [data, setData] = useState<BankNameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bank_name_column_settings");
      if (stored) return JSON.parse(stored);
    }
    return defaultSettings;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-name-master");
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
      } else {
        toast.error(json.message || "Failed to load bank names");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bank names");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this Bank Name Master record?")) return;

    try {
      const res = await fetch(`/api/bank-name-master/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Bank Name deleted successfully");
        fetchData();
      } else {
        toast.error(json.message || "Failed to delete bank name");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error occurred while deleting bank name");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIndices = Object.keys(rowSelection).map((k) => parseInt(k));
    if (selectedIndices.length === 0) {
      toast.warning("Please select at least one record to delete");
      return;
    }

    const selectedIds = selectedIndices.map((index) => data[index]?.MSTR_ID).filter(Boolean);
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected bank records?`)) return;

    let successCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/bank-name-master/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (json.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} bank records`);
      setRowSelection({});
      fetchData();
    } else {
      toast.error("Failed to delete selected records");
    }
  };

  const handleExport = (format: string) => {
    toast.info(`Exporting as ${format}...`);
  };

  const columns = useMemo<ColumnDef<BankNameRecord>[]>(
    () => {
      const result: ColumnDef<BankNameRecord>[] = [
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
          cell: ({ row }) => {
            return <span className="text-slate-500 font-medium">{row.index + 1}</span>;
          },
        },
        {
          accessorKey: "Actions",
          id: "actions",
          header: "Actions",
          cell: ({ row }) => {
            const record = row.original;
            return (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                  onClick={() => router.push(`/bank-manager/bank-name-master/edit/${record.MSTR_ID}`)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                  onClick={() => handleDelete(record.MSTR_ID)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          },
        },
      ];

      columnSettings.forEach((setting) => {
        if (setting.visibleInList) {
          result.push({
            accessorKey: setting.systemName,
            id: setting.systemName,
            header: ({ column }) => {
              const isSortable = ["MSTR_CD", "MSTR_NM"].includes(setting.systemName);
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
              return <span className="font-bold text-slate-700">{setting.displayName}</span>;
            },
            cell: ({ getValue }) => {
              const val = getValue();
              if (setting.systemName === "MSTR_NM") {
                return <span className="text-slate-800 font-bold">{val !== null && val !== undefined ? String(val) : "-"}</span>;
              }
              if (setting.systemName === "MSTR_CD") {
                return <span className="text-slate-600 font-semibold">{val !== null && val !== undefined ? String(val) : "-"}</span>;
              }
              return (
                <span className="text-slate-500 font-medium max-w-xs truncate block font-sans">
                  {val !== null && val !== undefined ? String(val) : "-"}
                </span>
              );
            }
          });
        }
      });

      return result;
    },
    [columnSettings, router]
  );

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_name_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

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
          <span className="text-sm font-semibold text-slate-400">Loading bank list...</span>
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={data} 
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
