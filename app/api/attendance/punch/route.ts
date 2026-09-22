import { NextRequest, NextResponse } from 'next/server';
import { getAccessPayload, toIntOrNull } from '@/lib/auth/getAccessPayload';
import { findHeaderUser } from '@/lib/header/header-repository';
import { clockFor, punch, type PunchFailureCode } from '@/lib/attendance/punch-service';

/**
 * POST { action: 'in' | 'out', utcOffsetMinutes?: number }
 * Header quick-punch for the logged-in EMPLOYEE only (CI showed the button only when is_admin == 0).
 * The user is always taken from the access token, never from the request body.
 */
const STATUS_BY_CODE: Record<PunchFailureCode, number> = {
  DISABLED: 403,
  NO_ATTENDANCE_EMPLOYEE: 422,
  NO_ACTIVE_BRAND: 400,
  STATUS_MASTER_MISSING: 500,
  ALREADY_PUNCHED_IN: 409,
  NOT_PUNCHED_IN: 409,
  TOO_SOON: 409,
};

export async function POST(request: NextRequest) {
  const payload = getAccessPayload(request);
  if (!payload) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'in' && action !== 'out') {
    return NextResponse.json({ success: false, message: "action must be 'in' or 'out'." }, { status: 400 });
  }

  try {
    const user = await findHeaderUser(Number(payload.sub));
    if (!user || user.IS_DELETED) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (user.IS_ADMIN || user.IS_SYSADMIN) {
      return NextResponse.json({ success: false, message: 'Header punch is for employees only.' }, { status: 403 });
    }

    const result = await punch({
      action,
      userId: user.USER_ID,
      oaId: user.OA_ID,
      oaBrandId: toIntOrNull(payload.oaBrandId) ?? user.OA_BRAND_ID,
      device: (request.headers.get('user-agent') ?? '').slice(0, 250),
      clock: clockFor(typeof body?.utcOffsetMinutes === 'number' ? body.utcOffsetMinutes : null),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status: STATUS_BY_CODE[result.code] });
    }
    return NextResponse.json({ success: true, isPunchedIn: result.isPunchedIn, message: result.message });
  } catch (error) {
    console.error('Punch failed:', error);
    return NextResponse.json({ success: false, message: 'Punch failed. Please try again.' }, { status: 500 });
  }
}
