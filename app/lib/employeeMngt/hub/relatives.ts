import { prisma } from '@/lib/prisma';
import type { IdLabel } from '@/lib/systmMngt/shared';
import { RELATIVE_RELTYPE } from '../empContacts';
import { insertRow, updateRow, type EmployeeRef, type HubContext, type Tx } from './hubEngine';

/**
 * An employee's relatives (Dependents, Emergency Contacts): each relative is their own contact_mst row with
 * an oa_contacts row of relation type 615 owned by the employee's login user (USER_ID). CI's emergency
 * and dependent dropdown listed those contacts; picking one prefilled the name and birth date.
 *
 * Behaviour change: new relative contacts get no REF_EMP_ID (CI stamped the logged-in user's id there,
 * which made the relative look like that user's own contact).
 */

export type RelativeDetails = {
  firstName: string;
  lastName: string;
  dob: string;
  /** The relation the employee already gave this relative on Dependents / Emergency Contacts. */
  relation: string;
};

/**
 * The relatives the employee can pick: their user's relative contacts in the brand, plus any contact
 * their own dependent / emergency records point at (admin-created ones carry the admin's user id).
 */
export async function relativeOptions(employee: EmployeeRef, keep: unknown): Promise<{ list: IdLabel[]; details: Record<string, RelativeDetails> }> {
  const keepId = Number(keep) || -1;
  const rows = await prisma.$queryRaw<Array<{
    id: number; first: string | null; last: string | null; dob: string | null; dep: number | null; emerg: number | null;
  }>>`
    SELECT oc."OA_CNTCTS_ID" AS id, cm."CNTCT_FRST_NM" AS first, cm."CNTCT_LST_NM" AS last, to_char(cm."CNTCT_DOB", 'YYYY-MM-DD') AS dob,
      (SELECT d."RELATION_TYPE_ID" FROM dependent_dtl d WHERE d."OA_DEP_CNTCTS_ID" = oc."OA_CNTCTS_ID" AND d."EMP_ID" = ${employee.id}
        AND d."IS_DELETED" = 0 ORDER BY d."DEPENDENT_DTL_ID" DESC LIMIT 1) AS dep,
      (SELECT e."EMERG_CONTACT_RELATION_TYPE_ID" FROM emergency_contact_dtl e WHERE e."EMERG_CONTACT_ID" = oc."OA_CNTCTS_ID" AND e."EMP_ID" = ${employee.id}
        AND e."IS_DELETED" = 0 ORDER BY e."EMERGENCY_CONTACT_DTL_ID" DESC LIMIT 1) AS emerg
    FROM oa_contacts oc JOIN contact_mst cm ON cm."CNTCT_ID" = oc."CNTCT_ID"
    WHERE oc."OA_CNTCTS_ID" = ${keepId}
       OR (COALESCE(oc."IS_DELETED", false) = false AND (
            (oc."USER_ID" = ${employee.userId ?? -1} AND oc."OA_CNTCT_RELTYPE_ID" = ${RELATIVE_RELTYPE} AND oc."OA_BRAND_ID" = ${employee.brand})
            OR oc."OA_CNTCTS_ID" IN (SELECT d."OA_DEP_CNTCTS_ID" FROM dependent_dtl d WHERE d."EMP_ID" = ${employee.id} AND d."IS_DELETED" = 0)
            OR oc."OA_CNTCTS_ID" IN (SELECT e."EMERG_CONTACT_ID" FROM emergency_contact_dtl e WHERE e."EMP_ID" = ${employee.id} AND e."IS_DELETED" = 0)))
    ORDER BY cm."CNTCT_FRST_NM", cm."CNTCT_LST_NM", oc."OA_CNTCTS_ID"`;
  const details: Record<string, RelativeDetails> = {};
  const list = rows.map((r) => {
    const id = Number(r.id);
    details[String(id)] = {
      firstName: r.first ?? '', lastName: r.last ?? '', dob: r.dob ?? '', relation: (r.dep ?? r.emerg) ? String(r.dep ?? r.emerg) : '',
    };
    const name = [r.first, r.last].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
    return { value: id, label: name || `Contact #${id}` };
  });
  return { list, details };
}

/** The relative's name and birth date (contact_mst of the oa_contacts id). */
export async function relativeOf(orgContactId: number): Promise<{ first: string; last: string; dob: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ first: string | null; last: string | null; dob: string | null }>>`
    SELECT cm."CNTCT_FRST_NM" AS first, cm."CNTCT_LST_NM" AS last, to_char(cm."CNTCT_DOB", 'YYYY-MM-DD') AS dob
    FROM oa_contacts oc JOIN contact_mst cm ON cm."CNTCT_ID" = oc."CNTCT_ID" WHERE oc."OA_CNTCTS_ID" = ${orgContactId} LIMIT 1`;
  return rows[0] ? { first: rows[0].first ?? '', last: rows[0].last ?? '', dob: rows[0].dob ?? '' } : null;
}

export interface RelativeInput {
  /** The chosen relative (oa_contacts id), or null to add a new one. */
  orgContactId: number | null;
  firstName: string;
  lastName: string;
  dob: string | null;
  emergency: boolean;
}

/** Updates the chosen relative's name / birth date, or adds the relative; returns the oa_contacts and contact_mst ids. */
export async function saveRelative(tx: Tx, ctx: HubContext, input: RelativeInput): Promise<{ orgContactId: number; contactId: number }> {
  const { employee, subject } = ctx;
  const person = { CNTCT_FRST_NM: input.firstName.slice(0, 40), CNTCT_LST_NM: input.lastName.slice(0, 40), CNTCT_DOB: input.dob };
  if (input.orgContactId) {
    const [row] = await tx.$queryRaw<Array<{ id: number }>>`SELECT "CNTCT_ID" AS id FROM oa_contacts WHERE "OA_CNTCTS_ID" = ${input.orgContactId}`;
    await updateRow(tx, 'contact_mst', 'CNTCT_ID', row.id, person, subject.userId);
    if (input.emergency) await tx.$executeRaw`UPDATE oa_contacts SET "IS_EMERGENCY" = 1 WHERE "OA_CNTCTS_ID" = ${input.orgContactId}`;
    return { orgContactId: input.orgContactId, contactId: row.id };
  }
  const contactId = await insertRow(tx, 'contact_mst', 'CNTCT_ID', {
    ...person, CNTCT_SMOKER: false, REF_EMP_ID: null, OA_ID_ORIGINATED: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId,
  }, subject.userId);
  const orgContactId = await insertRow(tx, 'oa_contacts', 'OA_CNTCTS_ID', {
    OA_CNTCT_RELTYPE_ID: RELATIVE_RELTYPE, CNTCT_ID: contactId, NON_PRSNL: false, NON_PRSNL_CNTCT_TYP: null, IS_ACTIVE: true,
    IS_EMERGENCY: input.emergency ? 1 : 0, OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId,
  }, subject.userId);
  return { orgContactId, contactId };
}

/** Names: letters, spaces, apostrophes, hyphens and dots (CI: letters only), at most 40 (contact_mst). */
export const NAME = /^[\p{L} .'-]{1,40}$/u;

/** Whole years from `dob` to today. */
export function ageFrom(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  return Math.max(0, age);
}
