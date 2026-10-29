"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { banksheet } from "@/generated/prisma/client";

export type ResolvedTransaction = banksheet & {
  BANK_NAME?: string;
};

interface ColumnsProps {
  onRefresh: () => void;
}

export const getColumns = ({ onRefresh }: ColumnsProps): ColumnDef<ResolvedTransaction>[] => [
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
    accessorKey: "Actions",
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const transaction = row.original;
      const router = useRouter();

      const handleDelete = async () => {
        const confirmed = confirm(
          `Are you sure you want to delete this bank transaction: ${transaction.PARTICULARS || transaction.ID}?`
        );
        if (!confirmed) return;

        try {
          const res = await fetch(`/api/bank-transaction/${transaction.ID}`, {
            method: "DELETE",
          });

          if (!res.ok) throw new Error("Failed to delete transaction");

          toast.success("Bank transaction deleted successfully");
          onRefresh();
        } catch (error) {
          toast.error("Error deleting bank transaction");
        }
      };

      return (
        <div className="flex items-center gap-1 justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#0b5394] dark:text-[#8cb8f0] hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] rounded-md transition-all"
            onClick={() => router.push(`/bank-manager/bank-transaction/edit/${transaction.ID}`)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#0b5394] dark:text-[#8cb8f0] hover:text-[#083f72] dark:hover:text-[#cfe1fa] hover:bg-[#e3edf9] dark:hover:bg-[#16233d] rounded-md transition-all"
            onClick={handleDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
  },
  {
    accessorKey: "ID",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent font-semibold text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white mx-auto"
      >
        Id
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-mono text-[#323338] dark:text-[#d5dae4] text-xs">{row.original.ID}</span>,
  },
  {
    accessorKey: "TRANSACTION_DATE",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent font-semibold text-[#1a1818] dark:text-[#e6e9f0] hover:text-[#1a1818] dark:hover:text-white"
      >
        Transaction Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="whitespace-nowrap font-medium text-[#1a1818] dark:text-[#e6e9f0] text-xs">{row.original.TRANSACTION_DATE}</span>,
  },
  {
    id: "TRANSACTION_STATUS",
    header: "Transaction Status",
    cell: ({ row }) => {
      const statusId = row.original.TRANSACTION_STATUS;
      let label = "Pending";
      let colorClass = "bg-amber-50 dark:bg-amber-400/10 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-400/30";
      
      if (statusId === 2) {
        label = "Explained";
        colorClass = "bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/30";
      } else if (statusId === 3) {
        label = "Draft";
        colorClass = "bg-[#f1f3f8] dark:bg-white/10 text-[#1a1818] dark:text-[#e6e9f0] border-slate-300 dark:border-white/15";
      }

      return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
          {label}
        </span>
      );
    },
  },
  {
    id: "TRANSACTION_STATUS_ID",
    accessorKey: "TRANSACTION_STATUS",
    header: "Transaction Status Id",
    cell: ({ row }) => <span className="text-[#323338] dark:text-[#d5dae4] text-xs">{row.original.TRANSACTION_STATUS}</span>,
  },
  {
    accessorKey: "ACCOUNT_ID",
    header: "Account Id",
    cell: ({ row }) => <span className="text-[#323338] dark:text-[#d5dae4] text-xs">{row.original.ACCOUNT_ID}</span>,
  },
  {
    accessorKey: "PARTICULARS",
    header: "Particulars",
    cell: ({ row }) => (
      <span className="text-[#323338] dark:text-[#d5dae4] text-xs font-medium max-w-[200px] truncate block text-left" title={row.original.PARTICULARS}>
        {row.original.PARTICULARS || "-"}
      </span>
    ),
  },
  {
    accessorKey: "DESCRIPTION",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-[#323338] dark:text-[#d5dae4] text-xs max-w-[200px] truncate block text-left" title={row.original.DESCRIPTION}>
        {row.original.DESCRIPTION || "-"}
      </span>
    ),
  },
  {
    accessorKey: "CHQNO_REFNO",
    header: "Cheque Ref No",
    cell: ({ row }) => <span className="font-mono text-[#323338] dark:text-[#d5dae4] text-xs">{row.original.CHQNO_REFNO || "-"}</span>,
  },
  {
    accessorKey: "DEBIT_AMOUNT",
    header: () => <div className="text-right">Debit Amount</div>,
    cell: ({ row }) => {
      const val = parseFloat(row.original.DEBIT_AMOUNT || "0");
      if (isNaN(val) || val === 0) return <div className="text-right text-[#535768] dark:text-[#aab3c5]">-</div>;
      return (
        <div className="text-right font-semibold text-rose-700 dark:text-rose-300 text-xs">
          {val.toFixed(2)}
        </div>
      );
    },
  },
  {
    accessorKey: "CREDIT_AMOUNT",
    header: () => <div className="text-right">Credit Amount</div>,
    cell: ({ row }) => {
      const val = parseFloat(row.original.CREDIT_AMOUNT || "0");
      if (isNaN(val) || val === 0) return <div className="text-right text-[#535768] dark:text-[#aab3c5]">-</div>;
      return (
        <div className="text-right font-semibold text-emerald-700 dark:text-emerald-300 text-xs">
          {val.toFixed(2)}
        </div>
      );
    },
  },
  {
    accessorKey: "CLOSING_BAL",
    header: () => <div className="text-right">Closing Balance</div>,
    cell: ({ row }) => {
      const val = parseFloat(row.original.CLOSING_BAL || "0");
      return (
        <div className="text-right font-semibold text-[#1a1818] dark:text-[#e6e9f0] text-xs">
          {val.toFixed(2)}
        </div>
      );
    },
  },
  {
    accessorKey: "SOL",
    header: "SOL",
    cell: ({ row }) => <span className="text-[#323338] dark:text-[#d5dae4] text-xs">{row.original.SOL}</span>,
  },
  {
    accessorKey: "ACCOUNTING_TRANSACTION_TYPE",
    header: "Transaction Type",
    cell: ({ row }) => {
      const type = row.original.ACCOUNTING_TRANSACTION_TYPE;
      const isCredit = type === "BTTI";
      return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
          isCredit ? "bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-400/10 text-rose-700 dark:text-rose-300"
        }`}>
          {isCredit ? "Credit" : "Debit"}
        </span>
      );
    },
  },
];
