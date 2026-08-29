import { NextResponse } from 'next/server';
import { getEmployeeDashboardData } from '@/lib/dashboard/services/employeeDashboardService';

export const dynamic = 'force-dynamic'; // always fetch fresh KPI data, never statically cache

export async function GET() {
  try {
    const data = await getEmployeeDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('GET /api/dashboard/employee failed:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to load employee dashboard data' },
      { status: 500 }
    );
  }
}
