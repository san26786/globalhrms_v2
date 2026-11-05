import { prisma } from '@/lib/prisma';
import { outdoorAllowanceDefs } from '../defs/outdoor_allowance';
import { isoDate, type HubConfig } from '../hubEngine';

/**
 * CI outdoor_allowance/outdoor_allowance ("Outdoor Allowance Details"): the periods an employee was posted
 * elsewhere (table outdoor_allowance). An eligible period earns the "Outdoor Allowance" salary component
 * (SCODA): Generate Salary pays the brand's benefit-rule amount for it, pro-rated by the period's days in
 * the pay month. This screen only records the periods.
 *
 * Behaviour changes: only admins add, edit or delete (CI let any user tick their own eligibility, which
 * payroll then paid; every permission check was dead code and any record could be changed by id); the
 * record is the employee's (CI saved the OA / brand / user posted from the form); the end date cannot be
 * before the start date and an employee's periods cannot overlap (payroll used one of them at random);
 * the location is at most 100 characters (the column's size); editing keeps the creator (CI overwrote it).
 */
const ELIGIBLE = `CASE WHEN btrim(t."IS_ELIGIBLE_ODA") = '1' THEN 'Yes' ELSE 'No' END`;

const dmy = (d: string) => d.split('-').reverse().join('-');

export const outdoorAllowanceConfig: HubConfig = {
  key: 'outdoor_allowance',
  defs: outdoorAllowanceDefs,
  table: 'outdoor_allowance',
  pk: 'OD_ALLOWANCE_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."OD_ALLOWANCE_LOC", ${isoDate('t."START_DATE"')} AS "START_DATE", ${isoDate('t."END_DATE"')} AS "END_DATE",
    ${ELIGIBLE} AS "IS_ELIGIBLE_ODA"`,
  search: ['OD_ALLOWANCE_LOC', 'START_DATE', 'END_DATE', 'IS_ELIGIBLE_ODA'],
  sorts: ['OD_ALLOWANCE_LOC', 'START_DATE', 'END_DATE', 'IS_ELIGIBLE_ODA'],
  bind: { outdoor_allowance_location: 'OD_ALLOWANCE_LOC', startDate: 'START_DATE', endDate: 'END_DATE', is_eligible_ODA: 'IS_ELIGIBLE_ODA' },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: {
    created: 'Successfully Added Outdoor Allowance Detail',
    updated: 'Successfully Updated Outdoor Allowance Detail',
    deleted: 'Successfully Deleted Outdoor Allowance Detail',
  },

  async validate(v, check, ctx) {
    if (check.has('startDate') || check.has('endDate')) return;
    const start = String(v.startDate);
    const end = String(v.endDate);
    if (ctx.existing && start === ctx.existing.startDate && end === ctx.existing.endDate) return;
    if (end < start) return check.fail('endDate', 'The End Date cannot be before the Start Date.');
    const [overlap] = await prisma.$queryRaw<Array<{ s: string; e: string }>>`
      SELECT to_char(o."START_DATE", 'YYYY-MM-DD') AS s, to_char(o."END_DATE", 'YYYY-MM-DD') AS e FROM outdoor_allowance o
      WHERE o."EMP_ID" = ${ctx.employee.id} AND o."IS_DELETED" = 0 AND o."OD_ALLOWANCE_ID" <> ${ctx.id ?? -1}
        AND o."START_DATE" <= ${end}::date AND o."END_DATE" >= ${start}::date
      ORDER BY o."START_DATE" LIMIT 1`;
    if (overlap) {
      check.fail('startDate', `This employee already has an outdoor allowance from ${dmy(overlap.s)} to ${dmy(overlap.e)} that overlaps these dates.`);
    }
  },
};
