/**
 * lib/dashboard/context.ts
 *
 * Resolves the multi-tenant + permission context every dashboard query needs,
 * equivalent to CodeIgniter's:
 *   $this->session->userdata('is_admin')
 *   $this->session->userdata('oaBrandID')
 *
 * Built only from the verified access-token subject that `withApi` hands the
 * dashboard routes (lib/auth/getSubject), never from client-supplied cookies.
 * `subject.oaBrandId` is the active brand, so a brand switch carries over.
 * Everything downstream (queries/services) only depends on the
 * `DashboardContext` shape in lib/dashboard/types.ts.
 */
import type { RequestSubject } from '@/lib/auth/getSubject';
import { DashboardContext } from './types';

export type { DashboardContext };

/** In the legacy PHP app, is_admin === 2 means "super admin" (sees all brands). */
const SUPER_ADMIN_FLAG = 2;

export function getDashboardContext(subject: RequestSubject): DashboardContext {
  return {
    isAdmin: subject.adminLevel > 0,
    isSuperAdmin: subject.adminLevel === SUPER_ADMIN_FLAG,
    oaBrandId: subject.oaBrandId,
    userId: subject.userId,
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
