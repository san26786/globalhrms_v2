import { NextResponse } from 'next/server';
import { getLeaveDashboardData } from '@/lib/dashboard/services/leaveDashboardService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getLeaveDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('GET /api/dashboard/leave failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to load leave dashboard data' },
      { status: 500 }
    );
  }
}
