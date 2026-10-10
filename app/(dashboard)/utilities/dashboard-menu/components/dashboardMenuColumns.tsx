'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Pencil, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';

export const dashboardMenuColumns: ColumnDef<DashboardMenuListItem>[] = [
  {
    accessorKey: 'Actions',
    id: 'actions',
    cell: ({ row }) => {
      const menu = row.original;
      const router = useRouter();

      const handleDelete = async () => {
        // CI: no delete action exists on Dashboard_menu at all — only Add
        // and Edit. Preserved here as a disabled/no-op placeholder rather
        // than inventing a DELETE endpoint that has no legacy counterpart.
        toast.info('Deleting a Dashboard Menu entry is not supported (no such action existed in the legacy screen).');
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
            <DropdownMenuItem onClick={() => router.push(`/utilities/dashboard-menu/edit/${menu.id}`)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete}>
              <CircleX className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  {
    accessorKey: 'ID',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        ID
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: 'MENU_NM',
    header: 'Menu Name',
  },
  {
    accessorKey: 'URL',
    header: 'Menu Url',
  },
  {
    accessorKey: 'sequence',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Sequence
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
];
