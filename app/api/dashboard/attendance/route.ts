import { NextResponse } from 'next/server';
import { getAttendanceDashboardData } from '@/lib/dashboard/services/attendanceDashboardService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getAttendanceDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('GET /api/dashboard/attendance failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to load attendance dashboard data' },
      { status: 500 }
    );
  }
}
