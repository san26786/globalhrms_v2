"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { bankdetails } from "@/generated/prisma/client";
import { DataTable } from "./components/bank-detailsTable";
import BreadcrumbHeader from "./components/BreadcrumbHeader";
import FormSettingsModal, { ColumnSetting } from "./components/FormSettingsModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const defaultSettings: ColumnSetting[] = [
  { systemName: "BANK_ID", displayName: "Bank Id", visibleInList: true, visibleInForm: true },
  { systemName: "BANK_NAME", displayName: "Bank Name", visibleInList: true, visibleInForm: true },
  { systemName: "BANK_ACC_TYPE", displayName: "Account Type", visibleInList: true, visibleInForm: true },
  { systemName: "ACCOUNT_NM", displayName: "Account Name", visibleInList: true, visibleInForm: true },
  { systemName: "ACCOUNT_NO", displayName: "Account No", visibleInList: true, visibleInForm: true },
  { systemName: "ADDRESS", displayName: "Address", visibleInList: true, visibleInForm: true },
  { systemName: "IFSC_CD", displayName: "IFSC", visibleInList: true, visibleInForm: true },
  { systemName: "BRANCH_NM", displayName: "Branch Name", visibleInList: true, visibleInForm: true },
  { systemName: "OPENING_BAL", displayName: "Opening Balance", visibleInList: true, visibleInForm: true },
  { systemName: "DEPOSITS", displayName: "Deposits", visibleInList: true, visibleInForm: true },
  { systemName: "WITHDRAWALS", displayName: "Withdrawals", visibleInList: true, visibleInForm: true },
];

export default function BankDetailsPage() {
  const [bankDetailsList, setBankDetailsList] = useState<bankdetails[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const router = useRouter();

  // Load settings from localStorage
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bank_details_column_settings");
      if (stored) return JSON.parse(stored);
    }
    return defaultSettings;
  });

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const fetchBankDetails = async () => {
    try {
      const res = await fetch("/api/bank-details");
      const json = await res.json();
      setBankDetailsList(json.data ?? []);
    } catch (error) {
      console.error("Failed to fetch bank details", error);
    }
  };

  const handleDelete = async (id: number, name: string | null) => {
    const confirmed = confirm(
      `Are you sure you want to delete this bank detail: ${name || id}?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/bank-details/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete bank detail");

      toast.success("Bank detail deleted successfully");
      fetchBankDetails();
    } catch (error) {
      toast.error("Error deleting bank detail");
    }
  };

  // Dynamically compute table columns based on column settings
  const dynamicColumns = useMemo(() => {
    const result: any[] = [
      {
        id: "select",
        header: ({ table }: any) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }: any) => (
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
        cell: ({ row }: any) => {
          return <span className="text-slate-500 font-medium">{row.index + 1}</span>;
        },
      },
      {
        accessorKey: "Actions",
        id: "actions",
        header: "Actions",
        cell: ({ row }: any) => {
          const bankDetail = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                onClick={() => router.push(`/bank-manager/bank-details/edit/${bankDetail.BANK_ID}`)}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
                onClick={() => handleDelete(bankDetail.BANK_ID, bankDetail.BANK_NAME)}
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
          header: ({ column }: any) => {
            const isSortable = ["BANK_ID", "BANK_NAME"].includes(setting.systemName);
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
        });
      }
    });

    return result;
  }, [columnSettings]);

  const handleSaveSettings = (newSettings: ColumnSetting[]) => {
    setColumnSettings(newSettings);
    localStorage.setItem("bank_details_column_settings", JSON.stringify(newSettings));
    toast.success("Form settings saved successfully");
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader onOpenSettings={() => setIsSettingsOpen(true)} />
      <DataTable columns={dynamicColumns} data={bankDetailsList} />
      
      <FormSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={columnSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
