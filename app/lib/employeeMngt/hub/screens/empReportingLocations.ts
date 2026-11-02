import { BusinessRuleError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { empReportingLocationsDefs } from '../defs/empReportingLocations';
import { softDeleteRow, type HubConfig } from '../hubEngine';
import { brandOnlyMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/empReportingLocations ("Work Locations"): the locations an employee works at (table
 * emp_reporting_locations); the primary one follows the current job's work location (Job Detail).
 *
 * As CI: only admins add, edit or delete. Behaviour changes: saving a location makes the others
 * non-primary only when it is primary (CI cleared the employee's primary on every save); the primary
 * location cannot be deleted; the duplicate check is per employee and only when the location changes (CI
 * blocked re-saving the duplicates its Job Detail sync had created); a location that no longer exists is
 * shown by its id; locations are the employee's brand's.
 */
const LOCATION = 56;

export const empReportingLocationsConfig: HubConfig = {
  key: 'empReportingLocations',
  defs: empReportingLocationsDefs,
  table: 'emp_reporting_locations',
  pk: 'EMP_REPORTING_LOCATIONS_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `COALESCE((SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."LOCATION_ID" LIMIT 1), '#' || t."LOCATION_ID") AS "LOCATION",
    CASE WHEN t."IS_PRIMARY" = 1 THEN 'Yes' ELSE 'No' END AS "IS_PRIMARY"`,
  search: ['LOCATION', 'IS_PRIMARY'],
  sorts: ['LOCATION', 'IS_PRIMARY'],
  bind: { LOCATION_ID: 'LOCATION_ID', IS_PRIMARY: 'IS_PRIMARY' },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: { created: 'Successfully Added Employee Work Location', updated: 'Successfully Updated Employee Work Location', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => ({
    locations: await keepCurrent(await brandOnlyMasters({ id: LOCATION }, brand), row?.LOCATION_ID, masterLabel),
  }),

  async validate(v, check, ctx) {
    if (!v.LOCATION_ID || check.has('LOCATION_ID') || v.LOCATION_ID === ctx.existing?.LOCATION_ID) return;
    const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM emp_reporting_locations
      WHERE "EMP_ID" = ${ctx.employee.id} AND "LOCATION_ID" = ${Number(v.LOCATION_ID)} AND "IS_DELETED" = 0
        AND "EMP_REPORTING_LOCATIONS_ID" <> ${ctx.id ?? -1}`;
    if (dup.n) check.fail('LOCATION_ID', 'Employee Location already exists');
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),

  async afterWrite(tx, id, v, ctx) {
    if (!v.IS_PRIMARY) return;
    await tx.$executeRaw`
      UPDATE emp_reporting_locations SET "IS_PRIMARY" = 0, "UPDATED_BY" = ${ctx.subject.userId}, "UPDATED_ON" = now()
      WHERE "EMP_ID" = ${ctx.employee.id} AND "EMP_REPORTING_LOCATIONS_ID" <> ${id} AND "IS_PRIMARY" = 1 AND "IS_DELETED" = 0`;
  },

  async remove(tx, ctx) {
    if (ctx.existing?.IS_PRIMARY) {
      throw new BusinessRuleError('The primary work location cannot be deleted; mark another location as primary first.');
    }
    await softDeleteRow(tx, 'emp_reporting_locations', 'EMP_REPORTING_LOCATIONS_ID', ctx.id!, ctx.subject.userId);
  },
};
