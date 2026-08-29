/**
 * lib/dashboard/context.ts
 *
 * Resolves the multi-tenant + permission context every dashboard query needs,
 * equivalent to CodeIgniter's:
 *   $this->session->userdata('is_admin')
 *   $this->session->userdata('oaBrandID')
 *
 * ⚠️ ASSUMPTION FLAGGED: I don't have visibility into this project's real
 * auth/session mechanism (NextAuth, iron-session, a custom JWT cookie, etc.),
 * so this reads from cookies with sensible names and safe-by-default fallback
 * (treated as a non-admin, brand-scoped user with no data if nothing is
 * present). Swap the body of `getDashboardContext` for your real session
 * lookup — everything downstream (queries/services/API route) only depends
 * on the `DashboardContext` shape in lib/dashboard/types.ts, so nothing else
 * needs to change.
 */
import { cookies } from 'next/headers';
import { DashboardContext } from './types';

export type { DashboardContext };


/** In the legacy PHP app, is_admin === 2 means "super admin" (sees all brands). */
const SUPER_ADMIN_FLAG = 2;

export async function getDashboardContext(): Promise<DashboardContext> {
  const cookieStore = await cookies();

  const isAdminRaw = cookieStore.get('is_admin')?.value;
  const brandRaw = cookieStore.get('oaBrandID')?.value;
  const userIdRaw = cookieStore.get('userId')?.value;

  const isAdminValue = isAdminRaw ? Number(isAdminRaw) : 0;
  const isSuperAdmin = isAdminValue === SUPER_ADMIN_FLAG;

  return {
    isAdmin: isAdminValue > 0,
    isSuperAdmin,
    oaBrandId: brandRaw ? Number(brandRaw) : null,
    userId: userIdRaw ? Number(userIdRaw) : null,
  };
}

/**
 * Mirrors the recurring PHP guard:
 *   if ($this->session->userdata('is_admin') != 2) { $this->db->where('OA_BRAND_ID', ...) }
 * Returns true when a brand filter should be applied to the query.
 */
export function shouldScopeToBrand(ctx: DashboardContext): boolean {
  return !ctx.isSuperAdmin;
}
