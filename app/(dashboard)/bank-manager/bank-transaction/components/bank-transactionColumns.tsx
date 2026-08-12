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
            className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
            onClick={() => router.push(`/bank-manager/bank-transaction/edit/${transaction.ID}`)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all"
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
        className="p-0 hover:bg-transparent font-bold text-slate-700 hover:text-slate-900 mx-auto"
      >
        Id
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="font-mono text-slate-600 text-xs">{row.original.ID}</span>,
  },
  {
    accessorKey: "TRANSACTION_DATE",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="p-0 hover:bg-transparent font-bold text-slate-700 hover:text-slate-900"
      >
        Transaction Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <span className="whitespace-nowrap font-medium text-slate-700 text-xs">{row.original.TRANSACTION_DATE}</span>,
  },
  {
    id: "TRANSACTION_STATUS",
    header: "Transaction Status",
    cell: ({ row }) => {
      const statusId = row.original.TRANSACTION_STATUS;
      let label = "Pending";
      let colorClass = "bg-amber-50 text-amber-700 border-amber-200";
      
      if (statusId === 2) {
        label = "Explained";
        colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
      } else if (statusId === 3) {
        label = "Draft";
        colorClass = "bg-slate-100 text-slate-700 border-slate-300";
      }

      return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
          {label}
        </span>
      );
    },
  },
  {
    id: "TRANSACTION_STATUS_ID",
    accessorKey: "TRANSACTION_STATUS",
    header: "Transaction Status Id",
    cell: ({ row }) => <span className="text-slate-600 text-xs">{row.original.TRANSACTION_STATUS}</span>,
  },
  {
    accessorKey: "ACCOUNT_ID",
    header: "Account Id",
    cell: ({ row }) => <span className="text-slate-600 text-xs">{row.original.ACCOUNT_ID}</span>,
  },
  {
    accessorKey: "PARTICULARS",
    header: "Particulars",
    cell: ({ row }) => (
      <span className="text-slate-600 text-xs font-medium max-w-[200px] truncate block text-left" title={row.original.PARTICULARS}>
        {row.original.PARTICULARS || "-"}
      </span>
    ),
  },
  {
    accessorKey: "DESCRIPTION",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-slate-600 text-xs max-w-[200px] truncate block text-left" title={row.original.DESCRIPTION}>
        {row.original.DESCRIPTION || "-"}
      </span>
    ),
  },
  {
    accessorKey: "CHQNO_REFNO",
    header: "Cheque Ref No",
    cell: ({ row }) => <span className="font-mono text-slate-600 text-xs">{row.original.CHQNO_REFNO || "-"}</span>,
  },
  {
    accessorKey: "DEBIT_AMOUNT",
    header: () => <div className="text-right">Debit Amount</div>,
    cell: ({ row }) => {
      const val = parseFloat(row.original.DEBIT_AMOUNT || "0");
      if (isNaN(val) || val === 0) return <div className="text-right text-slate-400">-</div>;
      return (
        <div className="text-right font-semibold text-red-600 text-xs">
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
      if (isNaN(val) || val === 0) return <div className="text-right text-slate-400">-</div>;
      return (
        <div className="text-right font-semibold text-emerald-600 text-xs">
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
        <div className="text-right font-semibold text-slate-700 text-xs">
          {val.toFixed(2)}
        </div>
      );
    },
  },
  {
    accessorKey: "SOL",
    header: "SOL",
    cell: ({ row }) => <span className="text-slate-600 text-xs">{row.original.SOL}</span>,
  },
  {
    accessorKey: "ACCOUNTING_TRANSACTION_TYPE",
    header: "Transaction Type",
    cell: ({ row }) => {
      const type = row.original.ACCOUNTING_TRANSACTION_TYPE;
      const isCredit = type === "BTTI";
      return (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
          isCredit ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        }`}>
          {isCredit ? "Credit" : "Debit"}
        </span>
      );
    },
  },
];
