import { DashboardMeta } from '../types';

export const ATTENDANCE_DASHBOARD_META: DashboardMeta = {
  id: 'attendance-dashboard',
  title: 'Attendance Workspace',
  widgets: [
    { id: 'kpi-grid', title: 'Attendance KPIs', type: 'kpi-grid', dataKey: 'kpis', view: 'both' },
    { id: 'top-present', title: 'Top Presenties (Current Month)', type: 'table', dataKey: 'topPresent', view: 'both' },
    { id: 'top-absent', title: 'Top Absentees (Unplanned)', type: 'table', dataKey: 'topAbsent', view: 'both' },
    { id: 'top-half-days', title: 'Top Half Days Summary', type: 'table', dataKey: 'topHalfDays', view: 'both' },
    { id: 'early-going-7d', title: 'Early Going - Last 7 Days', type: 'table', dataKey: 'earlyGoingLast7Days', view: 'both' },
  ],
};
