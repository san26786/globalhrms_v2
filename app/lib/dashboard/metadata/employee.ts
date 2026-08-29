/**
 * lib/dashboard/metadata/employee.ts
 *
 * Declarative widget registry for the Employee Dashboard. This is the
 * "metadata-driven" layer the phase asks for: the UI doesn't hardcode which
 * widgets exist, it can walk this list to know what to render and which key
 * of EmployeeDashboardData feeds it. The existing component tree still
 * renders the same JSX/CSS — this registry is what a future config-driven
 * layout (or a permissions-based widget filter) would key off of, without
 * touching the UI.
 */
import { DashboardMeta } from '../types';

export const EMPLOYEE_DASHBOARD_META: DashboardMeta = {
  id: 'employee-dashboard',
  title: 'Employee Workspace',
  widgets: [
    { id: 'kpi-grid', title: 'Employee KPIs', type: 'kpi-grid', dataKey: 'kpis', view: 'demographics' },
    { id: 'gender-split', title: 'Employee Gender Split', type: 'donut', dataKey: 'genderSplit', view: 'demographics' },
    { id: 'employee-status', title: 'Employee Status', type: 'donut', dataKey: 'employeeStatus', view: 'demographics' },
    { id: 'pending-leave-demo', title: 'Pending Leave', type: 'table', dataKey: 'pendingLeave', view: 'demographics' },
    { id: 'department-engagement', title: 'Employee Engagement By Department', type: 'donut', dataKey: 'departmentEngagement', view: 'analytics' },
    { id: 'salary-slabs', title: 'Average Employee Count under Salary Slab', type: 'bar', dataKey: 'salarySlabs', view: 'analytics' },
    { id: 'joining-trend', title: 'Joining Trend', type: 'line', dataKey: 'joiningTrend', view: 'analytics' },
    { id: 'pending-leave-analytics', title: 'Pending Leave', type: 'table', dataKey: 'pendingLeave', view: 'analytics' },
  ],
};
