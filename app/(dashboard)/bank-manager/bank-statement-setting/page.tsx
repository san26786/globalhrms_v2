"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ChevronRight, 
  Database, 
  Plus, 
  Settings, 
  Trash2, 
  Pencil, 
  ChevronLeft, 
  ChevronRight as ChevronRightIcon,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  LogOut,
  FileSpreadsheet,
  FileText,
  Printer,
  Copy,
  SlidersHorizontal,
  Loader2,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState
} from "@tanstack/react-table";
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
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

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

    if (!confirm(`Are you sure you want to delete the mapping rules for ${selectedIndices.length} selected row(s)?`)) return;

    let successCount = 0;
    for (const index of selectedIndices) {
      const item = settingsList[index];
      if (item) {
        try {
          const res = await fetch(`/api/bank-statement-setting/${item.id}`, { method: "DELETE" });
          if (res.ok) successCount++;
        } catch (err) {
          console.error(err);
        }
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

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_statement_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

  // Define table columns
  const columns = useMemo(() => {
    const result: any[] = [
      {
        id: "select",
        header: ({ table }: any) => (
          <div className="flex justify-center items-center w-10">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className="rounded border-slate-300"
            />
          </div>
        ),
        cell: ({ row }: any) => (
          <div className="flex justify-center items-center w-10">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="rounded border-slate-300"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "sno",
        header: () => <span className="font-bold text-slate-700">S.No</span>,
        cell: (info: any) => <span className="text-slate-500 font-medium">{info.row.index + 1}</span>,
        enableSorting: false
      },
      {
        id: "actions",
        header: () => <span className="font-bold text-slate-700">Actions</span>,
        cell: ({ row }: any) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                onClick={() => router.push(`/bank-manager/bank-statement-setting/edit/${item.bankId}`)}
                title="Edit Settings for this Bank"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                onClick={() => handleDelete(item.id, item.bankName, item.csvColumn)}
                title="Delete Mapping"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
        enableSorting: false
      }
    ];

    columnSettings.forEach((setting) => {
      if (setting.visibleInList) {
        if (setting.systemName === "bankName") {
          result.push({
            accessorKey: "bankName",
            header: ({ column }: any) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
              >
                {setting.displayName}
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            ),
            cell: ({ row }: any) => {
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
            header: ({ column }: any) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
              >
                {setting.displayName}
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            ),
            cell: ({ row }: any) => (
              <span className="text-slate-600 font-semibold font-sans">{row.original.csvColumn}</span>
            ),
          });
        } else if (setting.systemName === "mappedColumn") {
          result.push({
            accessorKey: "mappedColumn",
            header: ({ column }: any) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
              >
                {setting.displayName}
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            ),
            cell: ({ row }: any) => (
              <span className="text-slate-600 font-semibold font-mono text-xs">{row.original.mappedColumn}</span>
            ),
          });
        } else if (setting.systemName === "crdbFlag") {
          result.push({
            accessorKey: "crdbFlag",
            header: ({ column }: any) => (
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="hover:bg-slate-50 text-slate-700 font-bold p-0 flex items-center gap-1"
              >
                {setting.displayName}
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            ),
            cell: ({ row }: any) => (
              <span className="text-slate-600 font-bold">{row.original.crdbFlag ? "1" : "0"}</span>
            ),
          });
        }
      }
    });

    return result;
  }, [router, settingsList, columnSettings]);

  const table = useReactTable({
    data: settingsList,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="container mx-auto p-4 space-y-6 text-left max-w-6xl">
      {/* Breadcrumb Header Card */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span className="font-semibold text-blue-600">
                Bank Statement Setting
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Bank Statement Setting
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Button */}
            <Link href="/bank-manager/bank-statement-setting/add">
              <Button
                size="icon"
                className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Configure Bank Statement Setting"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>

            {/* Export Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
                  title="Export Options"
                >
                  <LogOut className="h-5 w-5 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border border-slate-100 rounded-xl shadow-lg p-1.5 w-32 z-[100]">
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>EXCEL</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span>PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                  <Printer className="h-4 w-4 text-blue-500" />
                  <span>PRINT</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700 hover:text-slate-900">
                  <Copy className="h-4 w-4 text-slate-500" />
                  <span>COPY</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Configure Columns"
            >
              <Settings className="h-5 w-5" />
            </Button>

            {/* Delete Selected Button */}
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
              placeholder="Search Bank Name or column..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 h-10 rounded-xl border-slate-200 bg-white placeholder-slate-400 w-full focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 shrink-0">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <span>Showing {table.getFilteredRowModel().rows.length} of {settingsList.length} records</span>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-slate-400">Loading statement settings...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20">
                  {table.getFlatHeaders().map((header) => (
                    <th key={header.id} className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/40 transition-all duration-150"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3.5 px-5 text-sm">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="h-24 text-center text-slate-400 font-medium py-10"
                    >
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
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

      {/* Form customization settings modal */}
      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
