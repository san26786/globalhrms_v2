"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown, Pencil, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { common_type } from "@/generated/prisma/client";

export const columns: ColumnDef<common_type>[] = [
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
    cell: ({ row }) => {
      const commonType = row.original;
      const router = useRouter();

      const handleDelete = async () => {
        const confirmed = confirm(
          `Are you sure you want to delete this common type: ${commonType.TYP_CD || commonType.TYP_ID}?`
        );
        if (!confirmed) return;

        try {
          const res = await fetch(`/api/common/common_type/${commonType.TYP_ID}`, {
            method: "DELETE",
          });

          if (!res.ok) throw new Error("Failed to delete common type");

          toast.success("Common type deleted successfully");
          router.refresh();
        } catch (error) {
          toast.error("Error deleting common type");
        }
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="link" className="h-2 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-2 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Button
                variant="ghost"
                onClick={() => router.push(`/common/common_type/edit/${commonType.TYP_ID}`)}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Button variant="ghost" asChild onClick={handleDelete}>
                <Link href="/">
                  <CircleX className="mr-2 h-4 w-4" /> Delete
                </Link>
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  {
    accessorKey: "TYP_ID",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          TYP_ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "TYP_CD",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type Code
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "TYP_NM",
    header: "Type Name",
  },
  {
    accessorKey: "VIEW_NM",
    header: "View Name",
  },
];
