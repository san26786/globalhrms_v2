"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Database,
  Edit2,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  SlidersHorizontal,
  Loader2,
  Settings
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
    const selectedIds = Object.keys(rowSelection).map((index) => data[parseInt(index)].MSTR_ID);
    if (selectedIds.length === 0) {
      toast.warning("Please select at least one record to delete");
      return;
    }

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

  const columns = useMemo<ColumnDef<BankNameRecord>[]>(
    () => {
      const result: ColumnDef<BankNameRecord>[] = [
        {
          id: "select",
          header: ({ table }) => (
            <div className="flex justify-center items-center w-10">
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
                className="rounded border-slate-300"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex justify-center items-center w-10">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
                className="rounded border-slate-300"
              />
            </div>
          ),
          enableSorting: false
        },
        {
          id: "actions",
          header: () => <span className="font-bold text-slate-700">Actions</span>,
          cell: ({ row }) => (
            <div className="flex items-center gap-1">
              <Link href={`/bank-manager/bank-name-master/edit/${row.original.MSTR_ID}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(row.original.MSTR_ID)}
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
          enableSorting: false
        },
        {
          id: "sno",
          header: () => <span className="font-bold text-slate-700">S.No</span>,
          cell: (info) => <span className="text-slate-600 font-medium">{info.row.index + 1}</span>,
          enableSorting: false
        }
      ];

      columnSettings.forEach((setting) => {
        if (setting.visibleInList) {
          if (setting.systemName === "MSTR_CD") {
            result.push({
              accessorKey: "MSTR_CD",
              header: ({ column }) => (
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
                >
                  {setting.displayName}
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              ),
              cell: (info) => <span className="text-slate-600 font-semibold">{info.getValue() as string}</span>
            });
          } else if (setting.systemName === "MSTR_NM") {
            result.push({
              accessorKey: "MSTR_NM",
              header: ({ column }) => (
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
                >
                  {setting.displayName}
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              ),
              cell: (info) => <span className="text-slate-800 font-bold">{info.getValue() as string}</span>
            });
          } else {
            result.push({
              accessorKey: setting.systemName,
              header: ({ column }) => (
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
                >
                  {setting.displayName}
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              ),
              cell: (info) => (
                <span className="text-slate-500 font-medium max-w-xs truncate block font-sans">
                  {info.getValue() !== undefined && info.getValue() !== null ? String(info.getValue()) : "-"}
                </span>
              )
            });
          }
        }
      });

      return result;
    },
    [data, columnSettings]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_name_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="container mx-auto p-4 space-y-6 text-left max-w-6xl">
      {/* Premium Header Panel */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Bank Name Master</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Bank Name
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Add Button */}
            <Link href="/bank-manager/bank-name-master/add">
              <Button
                size="icon"
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Add New Bank Name"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>

            {/* Settings Button opening FormSettingsModal */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Configure Bank Name Master Columns"
            >
              <Settings className="h-5 w-5" />
            </Button>

            {/* Bulk Delete Selected Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleBulkDelete}
              className="rounded-full border-red-100 hover:border-red-200 bg-white hover:bg-red-50 text-red-500 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Delete Selected Records"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table Section Card Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filter Action Row */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search Bank Code or Name..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200 bg-white placeholder-slate-400 w-full focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <span>Showing {table.getFilteredRowModel().rows.length} of {data.length} records</span>
          </div>
        </div>

        {/* Table content view */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <span className="text-sm font-semibold text-slate-400">Loading bank list...</span>
            </div>
          ) : table.getFilteredRowModel().rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Database className="h-12 w-12 text-slate-200" />
              <span className="text-sm font-bold">No Bank Name records found</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20">
                  {table.getFlatHeaders().map((header) => (
                    <th
                      key={header.id}
                      className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/40 transition-all duration-150 group"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3.5 px-5 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Toolbar */}
        {!loading && table.getFilteredRowModel().rows.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span>Records per page:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-xs font-bold text-slate-700 px-2">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="h-8 w-8 rounded-lg border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Customization settings modal component */}
      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
