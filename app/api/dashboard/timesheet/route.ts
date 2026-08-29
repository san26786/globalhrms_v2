import { NextResponse } from 'next/server';
import { getTimesheetDashboardData } from '@/lib/dashboard/services/timesheetDashboardService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getTimesheetDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('GET /api/dashboard/timesheet failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to load timesheet dashboard data' },
      { status: 500 }
    );
  }
}
