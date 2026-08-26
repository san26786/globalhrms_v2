/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * GET /api/menu               -> top-level menu, rooted at the old default
 *                                 $parent_id = 370
 * GET /api/menu?parentId=123  -> menu rooted at a specific node (useful if
 *                                 you ever want to fetch a sub-tree lazily
 *                                 instead of the whole thing up front)
 * GET /api/menu?showTabs=1    -> mirrors the PHP $show_tabs flag
 *                                 (adds `AND md.SHOW_TAB = 1`)
 *
 * NOTE on imports below — adjust these two to match your actual project:
 *   - `@/lib/auth`   should export whatever you pass to getServerSession()
 *                     (commonly named `authOptions`).
 *   - `@/lib/prisma` should export your Prisma client singleton.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMenuTree } from '@/lib/menu/MenuService';
import { resolvePermissionsClassId } from '@/lib/menu/PermissionClass';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/authConfig';

const ROOT_PARENT_ID = 370;

export async function GET(request: NextRequest) {
  const token = request.cookies.get(authConfig.accessTokenCookie)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = Number(payload.sub);
  const oaBrandId = payload.oaBrandId ? Number(payload.oaBrandId) : null;

  if (!oaBrandId || Number.isNaN(oaBrandId)) {
    return NextResponse.json({ error: 'No active brand on session' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const showTabs = searchParams.get('showTabs') === '1';
  const parentIdParam = searchParams.get('parentId');
  const parentId = parentIdParam ? Number(parentIdParam) : ROOT_PARENT_ID;

  const isSysAdmin = Boolean(payload.isSysAdmin);

  let permissionsClassId: number | null = null;

  if (!isSysAdmin) {
    const resolved = await resolvePermissionsClassId(oaBrandId, userId);
    permissionsClassId = resolved.permissionsClassId;

    if (permissionsClassId === null) {
      return NextResponse.json({ menu: [] });
    }
  }

  const brandApplicationId: number | null = null;

  const menu = await getMenuTree({
    isSysAdmin,
    oaBrandId,
    permissionsClassId,
    brandApplicationId,
    showTabs,
    parentId,
  });

  return NextResponse.json({ menu });
}