'use client';

import EntityListView from '@/components/listview/EntityListView';

/**
 * CI: Dashboard_menu::index() — common_c::getTableDtl('menu_config_vw', 'ID', …) rendered by
 * include/listview_v. Columns, labels and visibility come from the entity configuration (Form
 * Settings); the list parameters live in lib/listview/listDefinitions.ts ('dashboard_menu').
 */
export default function DashboardMenuPage() {
  return <EntityListView list="dashboard_menu" />;
}
