  // 'use client';

  // import { useEffect, useState, useRef } from 'react';
  // import { DataTable } from '@/components/DataTable';
  // import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';
  // import { authFetch } from '@/lib/auth/authFetch';
  // import { buildTable } from '@/lib/table-builder/tableBuilder';
  // import BreadcrumbHeader from '@/lib/page-builder/pageBreadcrumbHeader';
  // import type { ColumnSetting } from '@/lib/import-export/ExportService';
  // /**
  //  * CI: Dashboard_menu::index() — listview built from `menu_config_vw` via
  //  * common_c::getTableDtl(). No generic table-metadata view/DTO was supplied
  //  * alongside this task, so the list here is built directly against the
  //  * repository's listMenus() (menu_config: ID / MENU_NM / URL / sequence /
  //  * SHOW_TAB / SHOW_MENU) rather than guessing at the view's exact column set.
  //  *
  //  * Reuses <DataTable> from common/common_type/components/CommonTypeTable.tsx
  //  * as-is — it's already a generic <TData, TValue> component, so no new
  //  * table component was created for this module.
  //  */

  // export default function DashboardMenuPage() {
  //   const [menus, setMenus] = useState<DashboardMenuListItem[]>([]);
  //   const [loading, setLoading] = useState(true);
  //   const tableRef = useRef<any>(null);
    
  //   useEffect(() => {
  //     fetchMenus();
  //   }, []);

  //   const fetchMenus = async () => {
  //     setLoading(true);
  //     try {
  //       const res = await authFetch('/api/utilities/dashboard-menu');
  //       const json = await res.json();
  //       setMenus(json.data ?? []);
  //     } catch (error) {
  //       console.error('Failed to fetch dashboard menu entries', error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };


  //   const displayFields = [
  //     { accessorKey: 'id', header: 'Menu ID' },
  //     { accessorKey: 'menuName', header: 'Menu Name' },
  //     { accessorKey: 'url', header: 'URL' },
  //     { accessorKey: 'sequence', header: 'Sequence' },
  //     { accessorKey: 'showTab', header: 'Show Tab' },
  //     { accessorKey: 'showMenu', header: 'Show Menu', visible: false },
  //   ];
  //   const { columns } = buildTable<DashboardMenuListItem>(displayFields);
  //     const columnSettings: ColumnSetting[] = displayFields.map((f) => ({
  //       systemName: f.accessorKey,
  //       displayName: f.header,
  //       visibleInList: f.visible !== false,
  //       visibleInForm: f.visible !== false,
  //     }));

  //   return (
  //     <div className="container mx-auto p-4 space-y-6">
  //       <BreadcrumbHeader 
  //               entity="utilities"
  //               title="Create Menu"
  //               filename="dashboard-menu"
  //               columnSettings={columnSettings}
  //               data={menus}
  //               tableRef={tableRef}
  //               onSuccess={fetchMenus}
  //               addHref='utilities/dashboard-menu/add'
  //         />
        
  //       <DataTable entity="dashboard-menu" columns={columns} data={menus} />
  //       {loading && <p className="text-sm text-gray-400">Loading…</p>}
  //     </div>
  //   );
  // }


//--------------------//

'use client';

import { DataTable } from '@/components/DataTable';
import BreadcrumbHeader from '@/lib/page-builder/pageBreadcrumbHeader';
import { useIndexPage } from '@/lib/table-builder/useIndexPage';
import type { DashboardMenuListItem } from '@/lib/dashboard-menu/types';

/**
 * CI: Dashboard_menu::index() — now config-driven like every other module.
 * All fetch/loading/column logic lives in useIndexPage(); this file only
 * supplies the props, same as the PHP controller only ever varying
 * $pvs_ObjNm across modules.
 */
export default function DashboardMenuPage() {
  const {
    data: menus,
    loading,
    columns,
    columnSettings,
    tableRef,
    refresh,
  } = useIndexPage<DashboardMenuListItem>({
    apiPath: '/api/utilities/dashboard-menu',
    entity: 'dashboard-menu',
    // Remove this once the route emits `columns` itself (see note below) —
    // until then it's the same displayFields you already had.
    columns: [
      { accessorKey: 'id', header: 'Menu ID' },
      {accessorKey: 'mstrId', header: 'MSTR ID'},
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
        addHref="utilities/dashboard-menu/add"
      />

      <DataTable entity="dashboard-menu" columns={columns} data={menus} />
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
    </div>
  );
} 