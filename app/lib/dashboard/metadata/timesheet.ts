import { DashboardMeta } from '../types';

export const TIMESHEET_DASHBOARD_META: DashboardMeta = {
  id: 'timesheet-dashboard',
  title: 'Timesheet Workspace',
  widgets: [
    { id: 'kpi-grid', title: 'Timesheet KPIs', type: 'kpi-grid', dataKey: 'kpis', view: 'both' },
    { id: 'fill-rates', title: 'Timesheet Fill Rates', type: 'kpi-grid', dataKey: 'fillRates', view: 'both' },
  ],
};
