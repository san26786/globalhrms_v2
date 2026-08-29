import { DashboardMeta } from '../types';

export const LEAVE_DASHBOARD_META: DashboardMeta = {
  id: 'leave-dashboard',
  title: 'Leave Workspace',
  widgets: [
    { id: 'kpi-grid', title: 'Leave KPIs', type: 'kpi-grid', dataKey: 'kpis', view: 'both' },
    { id: 'top-paid', title: 'Top Paid Leaves Taken', type: 'table', dataKey: 'topPaid', view: 'both' },
    { id: 'top-unpaid', title: 'Top Unpaid Leave registers', type: 'table', dataKey: 'topUnpaid', view: 'both' },
    { id: 'top-sick', title: 'Top Sick Leaves balance', type: 'table', dataKey: 'topSick', view: 'both' },
  ],
};
