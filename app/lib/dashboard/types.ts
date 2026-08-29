/**
 * lib/dashboard/types.ts
 *
 * Shared types for the metadata-driven dashboard architecture.
 * Ported from the CodeIgniter "Dashboard" module (controllers in
 * dashboard/dashboard/*.php, models in dashboardModel/dashboard/*.php).
 */

/** Multi-tenant + permission context, equivalent to CI's $this->session->userdata(...) */
export interface DashboardContext {
  /** Mirrors CI session `is_admin`. In the legacy app, is_admin === 2 means "super admin" and
   *  bypasses brand scoping on most queries. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Mirrors CI session `oaBrandID`. Ignored for super admins. */
  oaBrandId: number | null;
  userId: number | null;
}

/** A single KPI tile, e.g. "TOTAL NO OF CURRENT EMPLOYEE" */
export interface DashboardKpi {
  id: string;
  label: string;
  value: number;
}

/** Generic named-count row, used for gender split / employee status donuts */
export interface NamedCount {
  name: string;
  count: number;
}

/** Shape expected by <DonutChart /> (components/DonutChart.tsx) */
export interface DonutSegment {
  department: string;
  count: number;
  percentage: number;
  color: string;
}

/** Shape expected by <BarChart /> (components/BarChart.tsx) */
export interface SalarySlab {
  range: string;
  count: number;
}

/** Shape expected by <LineChart /> (components/LineChart.tsx) */
export interface JoiningTrendPoint {
  year: number;
  count: number;
}

/** Shape expected by <PendingTable /> (components/dashboard/PendingTable.tsx) */
export interface PendingLeaveRow {
  leaveRequestId: number;
  employeeName: string;
  reason: string;
  dateApplied: string; // ISO date
}

/** Full payload for the Employee Dashboard, one document, one API round-trip. */
export interface EmployeeDashboardData {
  kpis: {
    totalRegistered: number;
    totalCurrent: number;
    totalFormer: number;
    totalProbation: number;
    registeredThisMonth: number;
    resignedThisMonth: number;
  };
  genderSplit: NamedCount[];
  employeeStatus: NamedCount[];
  departmentEngagement: DonutSegment[];
  salarySlabs: SalarySlab[];
  joiningTrend: JoiningTrendPoint[];
  pendingLeave: PendingLeaveRow[];
}

/** Declarative widget descriptor used by the metadata registry (lib/dashboard/metadata). */
export type DashboardWidgetType = 'kpi-grid' | 'donut' | 'bar' | 'line' | 'table';

export interface DashboardWidgetMeta {
  id: string;
  title: string;
  type: DashboardWidgetType;
  /** Key into the dashboard's data payload this widget consumes */
  dataKey: string;
  /** view in which this widget is visible: matches the existing UI's viewMode toggle */
  view: 'analytics' | 'demographics' | 'both';
}

export interface DashboardMeta {
  id: string;
  title: string;
  widgets: DashboardWidgetMeta[];
}

// ---------------------------------------------------------------------------
// Attendance Dashboard
// ---------------------------------------------------------------------------

export interface AttendanceLeaderboardRow {
  name: string;
  count: number;
}

export interface AttendanceDashboardData {
  kpis: {
    presentToday: number;
    absentToday: number;
    earlyGoingToday: number;
    lateEntryToday: number;
  };
  topPresent: AttendanceLeaderboardRow[];
  topAbsent: AttendanceLeaderboardRow[];
  topHalfDays: AttendanceLeaderboardRow[];
  earlyGoingLast7Days: AttendanceLeaderboardRow[];
}

// ---------------------------------------------------------------------------
// Leave Dashboard
// ---------------------------------------------------------------------------

export interface LeaveLeaderboardRow {
  name: string;
  count: number;
}

export interface LeaveDashboardData {
  kpis: {
    paidToday: number;
    unpaidToday: number;
    sickToday: number;
    lieuToday: number;
  };
  topPaid: LeaveLeaderboardRow[];
  topUnpaid: LeaveLeaderboardRow[];
  topSick: LeaveLeaderboardRow[];
}

// ---------------------------------------------------------------------------
// Timesheet Dashboard
// ---------------------------------------------------------------------------

export interface TimesheetFillRate {
  title: string;
  percentage: number;
  filled: number;
  total: number;
}

export interface TimesheetDashboardData {
  kpis: {
    approved: number;
    pending: number;
    rejected: number;
    drafted: number;
  };
  fillRates: {
    today: TimesheetFillRate;
    yesterday: TimesheetFillRate;
    currentWeek: TimesheetFillRate;
    lastWeek: TimesheetFillRate;
    currentMonth: TimesheetFillRate;
  };
}
