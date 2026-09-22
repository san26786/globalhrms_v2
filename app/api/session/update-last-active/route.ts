import { NextRequest, NextResponse } from 'next/server';
import { getAccessPayload } from '@/lib/auth/getAccessPayload';
import { touchLastActive } from '@/lib/auth/session-activity';

/**
 * Port of login/login/updateUserLastActive. Called every 8 minutes by the header.
 * Replaces the earlier stub that read a CookieSessionReader this project doesn't use.
 */
export async function POST(request: NextRequest) {
  const payload = getAccessPayload(request);
  if (!payload) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await touchLastActive(Number(payload.sub));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Last-active update failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
