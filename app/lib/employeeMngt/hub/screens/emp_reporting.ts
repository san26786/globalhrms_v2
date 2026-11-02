import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { empReportingDefs } from '../defs/emp_reporting';
import { fullName, masterName, softDeleteRow, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/emp_reporting ("Employee Reporting"): who an employee reports to (table emp_reporting).
 * The Line Manager row mirrors emp_mst.MANAGER_ID, which Employee Manager and Team Employee Manager use.
 *
 * As CI: only admins add, edit or delete. Behaviour changes: saving or deleting the Line Manager row
 * updates emp_mst.MANAGER_ID (CI never did, so the two could drift; Employee Manager already keeps the
 * row in step the other way); an employee cannot be their own manager, nor get the same manager of the
 * same type twice or a second Line Manager; the list shows each reporting row once (CI's view repeated it
 * for every job row) with the department and designation of the current job; managers are the
 * employee's brand's.
 */
const MANAGER_TYPE = 171;
const REPORTING_MODE = 156;
const latestJob = (column: string) => `(SELECT j."${column}" FROM job_mst j WHERE j."EMP_ID" = t."EMP_ID" AND j."IS_DELETED" = 0 ORDER BY j."JOB_ID" DESC LIMIT 1)`;

/** CI getAllKnsEmp(): the brand's managers (IS_MANAGER = 1). */
async function managerOptions(brand: number | null) {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: number; label: string }>>(
    `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label FROM emp_mst em
     WHERE em."IS_MANAGER" ~ '^\\s*0*1(\\.0*)?\\s*$' AND em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int
     ORDER BY label, em."EMP_ID"`,
    brand ?? -1,
  );
  return rows.map((r) => ({ value: Number(r.value), label: r.label || `Employee #${r.value}` }));
}

async function employeeName(id: number): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`SELECT ${fullName('em')} AS name FROM emp_mst em WHERE em."EMP_ID" = $1::int`, id);
  return rows[0]?.name ?? null;
}

/** emp_mst.MANAGER_ID = the employee's (latest) live Line Manager row, or none. */
async function syncEmployeeManager(tx: Tx, ctx: HubContext): Promise<void> {
  const lineManager = await getMasterId('EMLM');
  const [row] = await tx.$queryRaw<Array<{ manager: number | null }>>`
    SELECT "MANAGER_ID" AS manager FROM emp_reporting
    WHERE "EMP_ID" = ${ctx.employee.id} AND "MANAGER_TYPE_ID" = ${lineManager} AND "IS_DELETED" = 0 AND COALESCE("MANAGER_ID", 0) <> 0
    ORDER BY "EMP_REPORTING_ID" DESC LIMIT 1`;
  const manager = row?.manager ?? null;
  await tx.$executeRaw`
    UPDATE emp_mst SET "MANAGER_ID" = ${manager}, "UPDATED_BY" = ${ctx.subject.userId}, "UPDATED_ON" = now()
    WHERE "EMP_ID" = ${ctx.employee.id} AND "MANAGER_ID" IS DISTINCT FROM ${manager}::int`;
}

export const empReportingConfig: HubConfig = {
  key: 'emp_reporting',
  defs: empReportingDefs,
  table: 'emp_reporting',
  pk: 'EMP_REPORTING_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT ${fullName('m')} FROM emp_mst m WHERE m."EMP_ID" = t."MANAGER_ID" LIMIT 1) AS "MANAGER_NAME",
    ${masterName(latestJob('DEPARTMENT_ID'))} AS "DEPARTMENT_NAME", ${masterName(latestJob('DESIGNATION_ID'))} AS "DESIGNATION_NAME",
    ${masterName('t."MANAGER_TYPE_ID"')} AS "MANAGER_TYPE", ${masterName('t."REPORTING_MODE_ID"')} AS "REPORTING_MODE"`,
  search: ['MANAGER_NAME', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'MANAGER_TYPE', 'REPORTING_MODE'],
  sorts: ['MANAGER_NAME', 'DEPARTMENT_NAME', 'DESIGNATION_NAME', 'MANAGER_TYPE', 'REPORTING_MODE'],
  bind: { MANAGER_ID: 'MANAGER_ID', MANAGER_TYPE_ID: 'MANAGER_TYPE_ID', REPORTING_MODE_ID: 'REPORTING_MODE_ID' },
  deleteMode: 'soft',
  adminOnlyWrites: true,
  messages: { created: 'Successfully Added Employee Reporting', updated: 'Successfully Updated Employee Reporting', deleted: 'Successfully Deleted' },

  async defaults() {
    const [lineManager, direct] = await Promise.all([getMasterId('EMLM'), getMasterId('DiRC')]);
    return { MANAGER_TYPE_ID: lineManager ? String(lineManager) : '', REPORTING_MODE_ID: direct ? String(direct) : '' };
  },

  options: async (_subject, brand, row) => {
    const [managers, types, modes] = await Promise.all([
      managerOptions(brand), brandMasters({ id: MANAGER_TYPE }, brand), brandMasters({ id: REPORTING_MODE }, brand),
    ]);
    return {
      managers: await keepCurrent(managers, row?.MANAGER_ID, employeeName),
      managerTypes: await keepCurrent(types, row?.MANAGER_TYPE_ID, masterLabel),
      reportingModes: await keepCurrent(modes, row?.REPORTING_MODE_ID, masterLabel),
    };
  },

  async validate(v, check, ctx) {
    if (!v.MANAGER_ID || !v.MANAGER_TYPE_ID || check.has('MANAGER_ID') || check.has('MANAGER_TYPE_ID')) return;
    const manager = Number(v.MANAGER_ID);
    const type = Number(v.MANAGER_TYPE_ID);
    if (manager === ctx.employee.id) {
      check.fail('MANAGER_ID', 'An employee cannot be their own manager.');
      return;
    }
    const unchanged = ctx.existing && v.MANAGER_ID === ctx.existing.MANAGER_ID && v.MANAGER_TYPE_ID === ctx.existing.MANAGER_TYPE_ID;
    if (unchanged) return;
    const lineManager = await getMasterId('EMLM');
    const [counts] = await prisma.$queryRaw<Array<{ same: number; line: number }>>`
      SELECT count(*) FILTER (WHERE "MANAGER_ID" = ${manager} AND "MANAGER_TYPE_ID" = ${type})::int AS same,
             count(*) FILTER (WHERE "MANAGER_TYPE_ID" = ${lineManager})::int AS line
      FROM emp_reporting WHERE "EMP_ID" = ${ctx.employee.id} AND "IS_DELETED" = 0 AND "EMP_REPORTING_ID" <> ${ctx.id ?? -1}`;
    if (counts.same) check.fail('MANAGER_ID', 'This Employee Reporting already exists.');
    else if (type === lineManager && counts.line) check.fail('MANAGER_TYPE_ID', 'This employee already has a Line Manager; edit that row instead.');
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),

  afterWrite: (tx, _id, _v, ctx) => syncEmployeeManager(tx, ctx),

  async remove(tx, ctx) {
    await softDeleteRow(tx, 'emp_reporting', 'EMP_REPORTING_ID', ctx.id!, ctx.subject.userId);
    await syncEmployeeManager(tx, ctx);
  },
};
