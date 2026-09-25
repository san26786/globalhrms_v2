'use client';

import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import BreadcrumbHeader from '@/lib/page-builder/pageBreadcrumbHeader';
import { useIndexPage } from '@/lib/table-builder/useIndexPage';
import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';

/**
 * CI: Dashboard_menu::index() — list of menu_config_vw with an Edit action per row
 * (CI configures no delete for this screen). Fetch/loading/column logic lives in useIndexPage().
 */
export default function DashboardMenuPage() {
  const router = useRouter();
  const {
    data: menus,
    loading,
    error,
    columns,
    columnSettings,
    tableRef,
    refresh,
  } = useIndexPage<DashboardMenuListItem>({
    apiPath: '/api/utilities/dashboard-menu',
    entity: 'dashboard-menu',
    columns: [
      { accessorKey: 'id', header: 'Menu ID' },
      { accessorKey: 'mstrId', header: 'MSTR ID' },
      { accessorKey: 'menuName', header: 'Menu Name' },
      { accessorKey: 'url', header: 'URL' },
      { accessorKey: 'sequence', header: 'Sequence' },
      { accessorKey: 'showTab', header: 'Show Tab' },
      { accessorKey: 'showMenu', header: 'Show Menu', visible: false },
    ],
  });

  return (
    <div className="container mx-auto p-4 space-y-6">
      <BreadcrumbHeader
        entity="dashboard-menu"
        title="Create Menu"
        filename="dashboard-menu"
        columnSettings={columnSettings}
        data={menus}
        tableRef={tableRef}
        onSuccess={refresh}
        addHref="/utilities/dashboard-menu/add"
      />

      <DataTable
        entity="dashboard-menu"
        columns={columns}
        data={menus}
        isLoading={loading && menus.length === 0}
        getRowId={(row) => String(row.id)}
        rowActions={[
          { label: 'Edit', icon: Pencil, onClick: (row) => router.push(`/utilities/dashboard-menu/edit/${row.id}`) },
        ]}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
