import { NextRequest, NextResponse } from 'next/server';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { buildHeaderSession } from '@/lib/header/header-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const payload = getAccessPayload(request);
  if (!payload) {
    // 401 lets authFetch() try /api/auth/refresh once and retry.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const offset = Number(request.nextUrl.searchParams.get('utcOffsetMinutes'));

  try {
    const session = await buildHeaderSession(payload, {
      clientOffsetMinutes: Number.isFinite(offset) ? offset : null,
    });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(session, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Header session failed:', error);
    return NextResponse.json({ error: 'Unable to load header session' }, { status: 500 });
  }
}
