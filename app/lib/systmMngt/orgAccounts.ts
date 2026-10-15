import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError, type FieldErrors } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';

/**
 * CI systmMngt/org_accounts ("Organisation") — the organisation list and the organisation form.
 * The header links here: superadmin → the list, other admins → their own organisation's form.
 *
 * Access (CI had no server checks and no menu entry): superadmin — every organisation, editable;
 * organisation admin — the list shows their organisation, the form is read-only; normal users — nothing
 * (CI listed only rows they created, i.e. none).
 *
 * Behaviour changes:
 *  - an admin can open only their own organisation (CI: any id in the URL);
 *  - saving keeps the organisation's status (CI reset it to Activated / Inactivated from the
 *    auto-activation setting on every save — status is changed with Activate / Deactivate);
 *  - "unique" checks ignore the organisation itself and deleted organisations; the contact number allows
 *    a leading + (CI's alpha_numeric rejected "+91…", so such organisations could not be saved);
 *  - Delete soft-deletes when the organisation has no active brands or users, otherwise CI's message
 *    (CI's dependency check always found the organisation itself, so delete never worked);
 *  - "Permanently Delete Selected Accounts" is not ported: it hard-deleted the tenant's rows from every
 *    table with foreign keys switched off, from raw SQL;
 *  - "Add New Org Account" is not here: CI's insert path never passed validation and its account set-up
 *    crashed — new organisations are created by registration (login/org_registration_c);
 *  - the address is shown (read-only); editing it was CI's address module, not ported yet.
 * Raw SQL: the Prisma model's types / nullability differ from the table (nullable text columns).
 */

export interface OrgAccountValues {
  oaCd: string;
  oaName: string;
  oaEmail: string;
  oaWebDomain: string;
  oaContactNo: string;
}

export interface OrgAccountInit {
  title: string;
  canEdit: boolean;
  values: OrgAccountValues;
  address: string;
  status: string;
  accountType: string;
}

interface OrgRow {
  OA_ID: number;
  OA_CD: string | null;
  OA_NM: string | null;
  OA_EMAIL: string | null;
  OA_WEB_DOMAIN: string | null;
  OA_CONTACT_NO: string | null;
  OA_ADDRESS: string | null;
  OA_STATUS_ID: number | null;
  OA_ACC_TYPE: number | null;
}

/** Superadmin: any organisation; admins: their own only. */
function assertCanSee(subject: RequestSubject, oaId: number): void {
  if (subject.adminLevel === 2) return;
  if (subject.adminLevel === 1 && subject.oaId === oaId) return;
  throw new NotFoundError('Organisation not found.');
}

async function findOrg(oaId: number): Promise<OrgRow | null> {
  const rows = await prisma.$queryRaw<OrgRow[]>`
    SELECT "OA_ID", "OA_CD", "OA_NM", "OA_EMAIL", "OA_WEB_DOMAIN", "OA_CONTACT_NO", "OA_ADDRESS", "OA_STATUS_ID", "OA_ACC_TYPE"
    FROM org_accounts WHERE "OA_ID" = ${oaId} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
  return rows[0] ?? null;
}

async function masterName(id: number | null): Promise<string> {
  if (!id) return '';
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT "MSTR_NM" AS name FROM independent_mst WHERE "MSTR_ID" = ${id} ORDER BY "MSTR_ID" LIMIT 1`;
  return rows[0]?.name ?? '';
}

/** CI address_mst_m::getAllAddressById: the non-empty address parts joined with ", ". */
async function addressText(raw: string | null): Promise<string> {
  if (!raw || !/^\d{1,9}$/.test(raw)) return '';
  const rows = await prisma.$queryRaw<Array<Record<string, string | null>>>`
    SELECT "FLAT_NO", "HOUSE_NO", "HOUSE_NAME", "ADDRESS_LINE_1", "ADDRESS_LINE_2", "ADDRESS_LINE_3", "ADDRESS_LINE_4",
           "ADDRESS_LINE_5", "CITY", "POSTCODE"
    FROM address_mst WHERE "ADDRESS_ID" = ${Number(raw)} LIMIT 1`;
  const r = rows[0];
  if (!r) return '';
  // Several address columns hold street / locality / territory ids (CI resolved them through its
  // address views, not migrated): plain numbers are left out, except the post code.
  return Object.entries(r)
    .map(([k, v]) => [k, v == null ? '' : String(v).trim()] as const)
    .filter(([k, v]) => v !== '' && (k === 'POSTCODE' || !/^\d+$/.test(v)))
    .map(([, v]) => v)
    .join(', ');
}

const required = (label: string) => `The ${label} field is required.`;
const text = (label: string, max = 250) =>
  z.string({ error: required(label) }).trim().min(1, required(label)).max(max, `The ${label} field can not exceed ${max} characters in length.`);

const saveSchema = z.object({
  oaCd: text('Organisation Code', 6).regex(/^[A-Za-z0-9_ ]+$/, 'The Organisation Code field may only contain alpha-numeric characters.'),
  oaName: text('Organisation Name'),
  oaEmail: text('Organisation Email').email('The Organisation Email field must contain a valid email address.'),
  oaWebDomain: text('Web Domain'),
  oaContactNo: text('Organisation Contact', 30).regex(/^[-+]?[0-9]+$/, 'The Organisation Contact field must contain an integer.'),
});

/** CI is_unique[org_accounts.COL] — the organisation itself and deleted organisations excluded. */
async function taken(column: 'OA_CD' | 'OA_NM' | 'OA_EMAIL' | 'OA_WEB_DOMAIN', value: string, oaId: number): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM org_accounts WHERE lower("${column}") = lower($1) AND "OA_ID" <> $2 AND COALESCE("IS_DELETED", 0) = 0`,
    value,
    oaId,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export const orgAccountsService = {
  /** CI index(): which rows the list shows (getTableDtl's OA_ID / CREATED_BY_USER_ID scoping). */
  async listScope(subject: RequestSubject) {
    if (subject.adminLevel === 2) return {};
    if (subject.adminLevel === 1 && subject.oaId) return { equals: [{ column: 'OA_ID', value: subject.oaId }] };
    return { in: { column: 'OA_ID', values: [] } };
  },

  /** What the list toolbar offers (CI: Activate / Deactivate for superadmin only). */
  capabilities(subject: RequestSubject) {
    return { canManage: subject.adminLevel === 2 };
  },

  async formInit(subject: RequestSubject, oaId: number): Promise<OrgAccountInit> {
    if (subject.adminLevel === 0) throw new ForbiddenError();
    assertCanSee(subject, oaId);
    const org = await findOrg(oaId);
    if (!org) throw new NotFoundError('Organisation not found.');
    const [address, status, accountType] = await Promise.all([
      addressText(org.OA_ADDRESS),
      masterName(org.OA_STATUS_ID),
      masterName(org.OA_ACC_TYPE),
    ]);
    return {
      title: 'Edit Organisation',
      canEdit: subject.adminLevel === 2,
      values: {
        oaCd: org.OA_CD ?? '',
        oaName: org.OA_NM ?? '',
        oaEmail: org.OA_EMAIL ?? '',
        oaWebDomain: org.OA_WEB_DOMAIN ?? '',
        oaContactNo: org.OA_CONTACT_NO ?? '',
      },
      address,
      status,
      accountType,
    };
  },

  /** CI update() (superadmin): code, name, email, domain, contact. */
  async save(subject: RequestSubject, oaId: number, body: unknown): Promise<{ message: string }> {
    if (subject.adminLevel !== 2) throw new ForbiddenError('Only the system administrator can change an organisation.');
    if (!(await findOrg(oaId))) throw new NotFoundError('Organisation not found.');
    const v = saveSchema.parse(body);

    const errors: FieldErrors = {};
    const checks = [
      ['oaCd', 'OA_CD', 'Organisation Code', v.oaCd],
      ['oaName', 'OA_NM', 'Organisation Name', v.oaName],
      ['oaEmail', 'OA_EMAIL', 'Organisation Email', v.oaEmail],
      ['oaWebDomain', 'OA_WEB_DOMAIN', 'Web Domain', v.oaWebDomain],
    ] as const;
    for (const [field, column, label, value] of checks) {
      if (await taken(column, value, oaId)) errors[field] = [`The ${label} field must contain a unique value.`];
    }
    if (Object.keys(errors).length) throw new ValidationError('Please correct the highlighted fields.', errors);

    await prisma.$executeRaw`
      UPDATE org_accounts SET "OA_CD" = ${v.oaCd}, "OA_NM" = ${v.oaName}, "OA_EMAIL" = ${v.oaEmail},
        "OA_WEB_DOMAIN" = ${v.oaWebDomain}, "OA_CONTACT_NO" = ${v.oaContactNo},
        "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "OA_ID" = ${oaId}`;
    return { message: 'Successfully Updated Organisation Account ' };
  },

  /** CI org_change_status/{OASA|OASI} (superadmin): Activate / Deactivate the selected organisations. */
  async changeStatus(subject: RequestSubject, statusCode: 'OASA' | 'OASI', ids: number[]): Promise<{ message: string; affected: number }> {
    if (subject.adminLevel !== 2) throw new ForbiddenError();
    if (!ids.length) throw new ValidationError('Please select an organisation.', { ids: ['Please select an organisation.'] });
    const statusId = await getMasterId(statusCode, { typeId: 42 });
    if (!statusId) throw new BusinessRuleError(`Organisation status ${statusCode} is not configured.`);
    const affected = await prisma.$executeRaw`
      UPDATE org_accounts SET "OA_STATUS_ID" = ${statusId}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "OA_ID" = ANY(${ids}::int[]) AND COALESCE("IS_DELETED", 0) = 0`;
    return { message: statusCode === 'OASA' ? 'Organisation(s) activated.' : 'Organisation(s) deactivated.', affected };
  },

  /** CI delete/{id}: soft delete when nothing depends on the organisation any more. */
  async remove(subject: RequestSubject, oaId: number): Promise<{ message: string }> {
    if (subject.adminLevel === 0) throw new ForbiddenError();
    assertCanSee(subject, oaId);
    if (subject.adminLevel !== 2) throw new ForbiddenError('Only the system administrator can delete an organisation.');
    if (!(await findOrg(oaId))) throw new NotFoundError('Organisation not found.');
    const deps = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT (SELECT COUNT(*) FROM oa_brands WHERE "OA_ID" = ${oaId} AND COALESCE("IS_DELETED", 0) = 0)
           + (SELECT COUNT(*) FROM user_mst WHERE "OA_ID" = ${oaId} AND COALESCE("IS_DELETED", false) = false) AS n`;
    if (Number(deps[0]?.n ?? 0) > 0) {
      throw new BusinessRuleError('Unable to delete Organisation.First delete all its dependencies.', 'ORG_HAS_DEPENDENCIES');
    }
    await prisma.$executeRaw`UPDATE org_accounts SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now() WHERE "OA_ID" = ${oaId}`;
    return { message: 'Successfully Deleted Organisation Account' };
  },
};
