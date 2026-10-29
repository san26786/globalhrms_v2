"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  { systemName: "MSTR_CD", displayName: "Bank Code", visibleInList: true, visibleInForm: true },
  { systemName: "MSTR_NM", displayName: "Bank Name", visibleInList: true, visibleInForm: true },
  { systemName: "MSTR_DESC", displayName: "Description", visibleInList: true, visibleInForm: true },
  { systemName: "IS_PREDEFINED", displayName: "Is Predefined", visibleInList: false, visibleInForm: false },
  { systemName: "USER_CAN_CREATE_DATA_", displayName: "User Can Create Data", visibleInList: false, visibleInForm: false },
  { systemName: "USER_CAN_EDIT_DATA_NM", displayName: "User Can Edit Data Name", visibleInList: false, visibleInForm: false },
  { systemName: "OA_BRAND_CD", displayName: "Brand Code", visibleInList: false, visibleInForm: false },
  { systemName: "APP_CD", displayName: "App Code", visibleInList: false, visibleInForm: false },
  { systemName: "IS_DEFAULT_FOR_SYNC", displayName: "Is Delete For Sync", visibleInList: false, visibleInForm: false }
];

export default function BankNameMasterPage() {
  const [data, setData] = useState<BankNameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();
  const tableRef = useRef<any>(null);

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
    if (!tableRef.current) return;
    const selectedRows = tableRef.current.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.warning("Please select at least one record to delete.");
      return;
    }
    const confirmed = confirm(`Are you sure you want to delete ${selectedRows.length} selected record(s)?`);
    if (!confirmed) return;

    let successCount = 0;
    for (const row of selectedRows) {
      try {
        const res = await fetch(`/api/bank-name-master/${row.original.MSTR_ID}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (json.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} record(s).`);
      tableRef.current.resetRowSelection();
      fetchData();
    } else {
      toast.error("Failed to delete selected records.");
    }
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
          header: () => <span className="font-semibold text-[#1a1818] dark:text-[#e6e9f0]">S.No.</span>,
          cell: ({ row }) => {
            return <span className="text-[#535768] dark:text-[#aab3c5] font-medium">{row.index + 1}</span>;
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
                  className="h-7 w-7 text-[#0b5394] dark:text-[#8cb8f0] hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] rounded-md transition-all"
                  onClick={() => router.push(`/bank-manager/bank-name-master/edit/${record.MSTR_ID}`)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#0b5394] dark:text-[#8cb8f0] hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] rounded-md transition-all"
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
                    className="font-semibold text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white flex items-center p-0 hover:bg-transparent"
                  >
                    {setting.displayName}
                    <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 text-[#535768] dark:text-[#aab3c5]" />
                  </Button>
                );
              }
              return <span className="font-semibold text-[#1a1818] dark:text-[#e6e9f0]">{setting.displayName}</span>;
            },
            cell: ({ getValue }) => {
              const val = getValue();
              if (setting.systemName === "MSTR_NM") {
                return <span className="text-[#1a1818] dark:text-[#f1f3f8] font-semibold">{val !== null && val !== undefined ? String(val) : "-"}</span>;
              }
              if (setting.systemName === "MSTR_CD") {
                return <span className="text-[#323338] dark:text-[#d5dae4] font-semibold">{val !== null && val !== undefined ? String(val) : "-"}</span>;
              }
              return (
                <span className="text-[#535768] dark:text-[#aab3c5] font-medium max-w-xs truncate block font-sans">
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
        entity="bank-name-master"
        title="Bank Name Master"
        filename="BankNames"
        columnSettings={columnSettings}
        data={data}
        tableRef={tableRef}
        onSuccess={fetchData}
      />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-white/10 border-t-blue-600" />
          <span className="text-sm font-semibold text-[#535768] dark:text-[#aab3c5]">Loading bank list...</span>
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={data} 
          onTableInstance={(instance) => { tableRef.current = instance; }}
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
