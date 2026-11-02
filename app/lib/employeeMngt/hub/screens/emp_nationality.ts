import { prisma } from '@/lib/prisma';
import { employeeOrgContact } from '../../empContacts';
import { empNationalityDefs } from '../defs/emp_nationality';
import { masterName, type HubConfig } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByType } from '../hubOptions';

/**
 * CI employeeMngt/emp_nationality ("Nationality"): an employee's nationalities (table
 * oa_contact_nationality; CNTCT_NATIONALITY_ID is a country master id — CI listed the country master,
 * type 61, not the nationality master). Several per employee, no primary.
 *
 * Behaviour changes: rows are tied to the employee by EMP_ID everywhere (CI's list found the employee
 * through USER_ID — the admin's "Requested By" user — and its employee tab fell back to every row when
 * the employee had no organisation contact); OA_CNTCT_ID is the employee's own organisation contact,
 * created along the contact chain when missing (CI could write a contact_mst id there, or create
 * oa_contacts rows without a contact); the duplicate check works on edit.
 */
const COUNTRY = 61;

export const empNationalityConfig: HubConfig = {
  key: 'emp_nationality',
  defs: empNationalityDefs,
  table: 'oa_contact_nationality',
  pk: 'OA_CNTCT_NATIONALITY_ID',
  empColumn: 'EMP_ID',
  alive: 'COALESCE(t."IS_DELETED", false) = false',
  listColumns: `${masterName('t."CNTCT_NATIONALITY_ID"')} AS "CNTCT_NATIONALITY_NM"`,
  search: ['CNTCT_NATIONALITY_NM'],
  sorts: ['CNTCT_NATIONALITY_NM'],
  bind: { CNTCT_NATIONALITY_ID: 'CNTCT_NATIONALITY_ID' },
  deleteMode: 'soft',
  messages: {
    created: 'Successfully Added Employee Nationality Detail',
    updated: 'Successfully Updated Nationality Details',
    deleted: 'Successfully Deleted',
  },

  options: async (_subject, _brand, row) => ({
    countries: await keepCurrent(await mastersByType(COUNTRY), row?.CNTCT_NATIONALITY_ID, masterLabel),
  }),

  async validate(v, check, ctx) {
    if (!v.CNTCT_NATIONALITY_ID || check.has('CNTCT_NATIONALITY_ID')) return;
    const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM oa_contact_nationality
      WHERE "EMP_ID" = ${ctx.employee.id} AND "CNTCT_NATIONALITY_ID" = ${Number(v.CNTCT_NATIONALITY_ID)}
        AND COALESCE("IS_DELETED", false) = false AND "OA_CNTCT_NATIONALITY_ID" <> ${ctx.id ?? -1}`;
    if (dup.n) check.fail('CNTCT_NATIONALITY_ID', 'Employee Nationality already exists');
  },

  /** OA_CNTCT_ID: the employee's organisation contact (employees without a login have none). */
  async afterWrite(tx, id, _v, ctx) {
    const { employee, subject } = ctx;
    if (!employee.userId) return;
    const orgContact = await employeeOrgContact(tx, {
      userId: employee.userId, empId: employee.id, oaId: employee.oaId, oaBrandId: employee.brand, actorId: subject.userId,
    });
    await tx.$executeRaw`UPDATE oa_contact_nationality SET "OA_CNTCT_ID" = ${orgContact} WHERE "OA_CNTCT_NATIONALITY_ID" = ${id}`;
  },
};
