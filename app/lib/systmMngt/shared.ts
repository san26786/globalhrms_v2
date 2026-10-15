import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { getMasterOptionsByTypeCode } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import type { ResourceAction } from '@/lib/resource/types';

/**
 * Helpers shared by the systmMngt ports (salary components, pay component / gross earnings
 * configuration, payslip settings, company documents, document templates).
 *
 * Behaviour change common to every screen here: CI read the record / brand from the URL or the
 * posted hidden fields with no ownership check (and several writes were not brand-scoped at all).
 * Every read and write is limited to the caller's active brand.
 */

export interface IdLabel {
  value: number;
  label: string;
}

/** CI showed these screens to anyone with the menu entry; the entry's permission grant decides. */
export async function authorize(subject: RequestSubject, menuUrl: string, action: ResourceAction): Promise<void> {
  if (!(await menuPolicy(menuUrl).check(subject, action))) throw new ForbiddenError();
}

/** The caller's active brand (every CI screen here used session oaBrandID). */
export function activeBrand(subject: RequestSubject): number {
  if (!subject.oaBrandId) throw new BusinessRuleError('Select a brand first.', 'NO_ACTIVE_BRAND');
  return subject.oaBrandId;
}

/** CI is_admin == 1 actions (Sync buttons). */
export function requireBrandAdmin(subject: RequestSubject): void {
  if (subject.adminLevel !== 1) throw new ForbiddenError('Only brand administrators can do this.');
}

export async function brandOrgId(oaBrandId: number, fallback: number | null): Promise<number> {
  if (fallback) return fallback;
  const row = await prisma.oa_brands.findFirst({ where: { OA_BRAND_ID: oaBrandId }, select: { OA_ID: true } });
  return row?.OA_ID ?? 0;
}

/** CI common_type_m::getTypeIdFromCode(code): common_type.TYP_ID of a type code (e.g. CDT → 283). */
export async function commonTypeId(code: string): Promise<number | null> {
  const row = await prisma.common_type.findFirst({ where: { TYP_CD: code }, select: { TYP_ID: true }, orderBy: { TYP_ID: 'asc' } });
  return row?.TYP_ID ?? null;
}

/** CI getAllIndMstDetailsByTypeCode(code) — de-duplicated (every master row is stored twice). */
export async function mastersOfTypeCode(typeCode: string): Promise<IdLabel[]> {
  const options = await getMasterOptionsByTypeCode(typeCode);
  return options.map((o) => ({ value: o.value, label: o.label }));
}

export function parseId(raw: string | number | null | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError();
  return id;
}

/** CI posted '' for empty fields; PostgreSQL rejects '' for int / real / date columns. */
export const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/**
 * Stored-HTML hygiene for rich-text bodies (document templates). CI's MY_Security kept `style` on
 * these URLs and stripped `on*` handlers and `xmlns`; this also removes script / iframe / object /
 * embed elements and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  return html
    // dangerous elements with their content, then any stray opening / closing tag of them
    .replace(/<\s*(script|style|iframe|object|embed|frame|frameset|meta|link|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|frame|frameset|meta|link|base|form)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+xmlns(:[a-z]+)?\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
}
