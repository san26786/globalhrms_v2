import { prisma } from '@/lib/prisma';
import { EXIT_LITERALS, EXIT_MASTERS, EXIT_STEPS, exitClearanceDefs, exitStepDefs, type ExitItem, type ExitStep } from '../defs/exit_clearance';
import { fullName, isoDate, masterName, softDeleteRow, type DbValue, type HubConfig, type HubOptionList, type Tx } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByCode } from '../hubOptions';
import { separationDateSql } from '../../termination';

/**
 * CI department_activity/* ("Exit and Clearance Formality"): an employee's exit clearance, one record per
 * department — department_head_supervisor (the list), gna_and_admin, account_finance, facilities_it,
 * human_resource — tied by EMP_ID. The clearance pages (app/(dashboard)/department_activity/…) show the
 * five steps; the exit form / relieving order / experience letter PDFs: lib/employeeMngt/exitDocuments.ts.
 *
 * As CI: one menu governs every step; each checklist item stores its status (Yes / No, Completed …, or a
 * master id of Deposited / Settled / Submitted); CI's comment boxes were never shown and stay empty.
 * Behaviour changes: only admins add, edit or delete (CI let any user who knew the URL fill every
 * department's sign-off, normal users for themselves); one clearance per employee, and each department's
 * step once (CI added duplicates and read the oldest); a department's step needs the clearance first;
 * "Charge Handover to" shows once the handover is Yes (CI never showed it) and lists the employee's
 * brand's colleagues; the last appraisal date comes from the current job at save time (CI read the oldest
 * job, for a normal user a deleted one); the KT plan stays unless replaced (CI wiped it on every edit), is
 * served only to users who may see the clearance and needs EXIT_KT_PLAN_DIR; an unanswered status is
 * stored empty (CI: '0'); deleting the clearance deletes every department's step (soft; CI hard-deleted
 * the first and left the rest).
 *
 * department_head_supervisor.APPARAISAL_COMPLETED_REMARKS is a NOT NULL date: an employee without an
 * appraisal date gets NO_APPRAISAL_DATE there (CI: MySQL's zero date), shown as empty.
 */
const NO_APPRAISAL_DATE = '1970-01-01';
const realDate = (expr: string) => `CASE WHEN ${expr} > DATE '1971-01-01' THEN ${expr} END`;
const isMaster = (i: ExitItem) => i.options in EXIT_MASTERS;

/** The item's status as shown (master name, or the literal; CI's '0' = unanswered). */
export const itemValueSql = (i: ExitItem, alias = 't') =>
  isMaster(i) ? masterName(`${alias}."${i.column}"`) : `NULLIF(NULLIF(btrim(${alias}."${i.column}"), '0'), '')`;

/** Status lists of every option kind the step uses. */
async function statusOptions(step: ExitStep, row: Record<string, unknown> | null): Promise<Record<string, HubOptionList>> {
  const out: Record<string, HubOptionList> = {};
  for (const kind of new Set(step.items.map((i) => i.options))) {
    if (kind in EXIT_LITERALS) {
      out[kind] = EXIT_LITERALS[kind as keyof typeof EXIT_LITERALS].map((v) => ({ value: v, label: v }));
    } else {
      let list = await mastersByCode(EXIT_MASTERS[kind as keyof typeof EXIT_MASTERS]);
      for (const i of step.items.filter((x) => x.options === kind)) list = await keepCurrent(list, row?.[i.column], masterLabel);
      out[kind] = list;
    }
  }
  return out;
}

async function lastAppraisal(tx: Tx, employeeId: number): Promise<string | null> {
  const [row] = await tx.$queryRaw<Array<{ d: string | null }>>`
    SELECT to_char("LAST_APPRAISAL_DATE", 'YYYY-MM-DD') AS d FROM job_mst
    WHERE "EMP_ID" = ${employeeId} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" DESC LIMIT 1`;
  return row?.d ?? null;
}

/** Live employees of the brand other than the employee (CI getAllEmployeeMst), with the stored choice kept. */
async function handoverOptions(employee: { id: number; brand: number }, current: unknown): Promise<HubOptionList> {
  const rows = await prisma.$queryRawUnsafe<Array<{ value: number; label: string; code: string | null }>>(
    `SELECT em."EMP_ID" AS value, ${fullName('em')} AS label, em."EMP_NBR" AS code FROM emp_mst em
     WHERE em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = $1::int AND em."EMP_ID" <> $2::int ORDER BY label, em."EMP_ID"`,
    employee.brand, employee.id,
  );
  const list = rows.map((r) => ({ value: Number(r.value), label: r.code ? `${r.label} (${r.code})` : r.label }));
  return keepCurrent(list, current, async (id) => {
    const [r] = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`SELECT ${fullName('em')} AS name FROM emp_mst em WHERE em."EMP_ID" = $1::int`, id);
    return r?.name ?? null;
  });
}

async function liveRow(table: string, pk: string, employeeId: number): Promise<number | null> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT "${pk}" AS id FROM ${table} WHERE "EMP_ID" = $1::integer AND "IS_DELETED" = 0 ORDER BY "${pk}" DESC LIMIT 1`,
    employeeId,
  );
  return row ? Number(row.id) : null;
}

const [DH] = EXIT_STEPS;
const exists = (step: ExitStep) => `EXISTS (SELECT 1 FROM ${step.table} x WHERE x."EMP_ID" = t."EMP_ID" AND x."IS_DELETED" = 0)`;

/** Settings shared by the five steps. */
function stepConfig(step: ExitStep, title: string): Omit<HubConfig, 'key' | 'defs' | 'listColumns' | 'search' | 'sorts'> {
  return {
    table: step.table,
    pk: step.pk,
    empColumn: 'EMP_ID',
    alive: 't."IS_DELETED" = 0',
    bind: Object.fromEntries(step.items.map((i) => [i.column, i.column])),
    deleteMode: 'soft',
    adminOnlyWrites: true,
    messages: { created: 'Successfully Added', updated: 'Successfully Updated', deleted: 'Successfully Deleted' },
    options: async (_subject, _brand, row) => statusOptions(step, row),

    async validate(_v, check, ctx) {
      if (ctx.id) return;
      if (step !== DH && !(await liveRow(DH.table, DH.pk, ctx.employee.id))) {
        check.fail('EMP_ID', 'Start the exit clearance (Department Head / Supervisor) first.');
      } else if (await liveRow(step.table, step.pk, ctx.employee.id)) {
        check.fail('EMP_ID', step === DH ? 'Exit and clearance for this employee already exists.' : `The ${title} details of this employee already exist; edit them instead.`);
      }
    },

    // CI's comment columns (NOT NULL) start empty.
    extraColumns: (_v, ctx) => (ctx.id ? {} : Object.fromEntries(step.items.map((i) => [i.comment, '']))),
  };
}

export const exitClearanceConfig: HubConfig = {
  ...stepConfig(DH, 'Department Head/Supervisor'),
  key: 'exit_clearance',
  defs: exitClearanceDefs,
  listColumns: `${isoDate(realDate('t."APPARAISAL_COMPLETED_REMARKS"'))} AS "APPARAISAL_COMPLETED_REMARKS",
    ${separationDateSql('em')} AS "SEPARATION_DATE",
    ${DH.items.map((i) => `${itemValueSql(i)} AS "${i.column}"`).join(', ')},
    (SELECT ${fullName('h')} FROM emp_mst h WHERE h."EMP_ID" = CASE WHEN t."CHARGE_HANDOVER_TO_REMARKS" ~ '^[0-9]+$' THEN t."CHARGE_HANDOVER_TO_REMARKS"::bigint END LIMIT 1)
      AS "CHARGE_HANDOVER_TO_REMARKS_NM",
    (1 + ${EXIT_STEPS.slice(1).map((s) => `(CASE WHEN ${exists(s)} THEN 1 ELSE 0 END)`).join(' + ')}) || ' of ${EXIT_STEPS.length}' AS "STEPS_DONE",
    CASE WHEN t."IS_GENERATED" = 1 THEN 'Yes' ELSE 'No' END AS "IS_GENERATED", ${isoDate('t."CREATED_ON"')} AS "CREATED_ON"`,
  search: ['SEPARATION_DATE', 'IS_GENERATED', 'CHARGE_HANDOVER_TO_REMARKS_NM'],
  sorts: ['SEPARATION_DATE', 'APPARAISAL_COMPLETED_REMARKS', 'IS_GENERATED', 'CREATED_ON'],
  bind: { ...stepConfig(DH, '').bind, CHARGE_HANDOVER_TO_REMARKS: 'CHARGE_HANDOVER_TO_REMARKS' },

  attachment: {
    column: 'KT_PLAN_ATTECHMENT',
    store: {
      envVar: 'EXIT_KT_PLAN_DIR',
      allowed: new Set(['doc', 'docx', 'xls', 'xlsx', 'pdf', 'txt']),
      maxBytes: 10 * 1024 * 1024,
      maxNameLength: 255,
    },
  },

  employeeOptions: async (employee, row) => ({
    options: { handoverEmployees: await handoverOptions(employee, row?.CHARGE_HANDOVER_TO_REMARKS) },
    extras: {},
  }),

  read(row, values) {
    const d = row.APPARAISAL_COMPLETED_REMARKS;
    const iso = d instanceof Date ? d.toISOString().slice(0, 10) : '';
    values.lastAppraisal = iso > '1971-01-01' ? iso : '';
  },

  async extraColumns(v, ctx) {
    const appraisal = await lastAppraisal(prisma, ctx.employee.id);
    const extra: Record<string, DbValue> = { APPARAISAL_COMPLETED_REMARKS: appraisal ?? NO_APPRAISAL_DATE };
    if (!ctx.id) Object.assign(extra, { APPARAISAL_COMPLETED: '', CHARGE_HANDOVER_TO: '', IS_GENERATED: 0 }, Object.fromEntries(DH.items.map((i) => [i.comment, ''])));
    return extra;
  },

  /** The clearance goes with every department's step. */
  async remove(tx, ctx) {
    await softDeleteRow(tx, DH.table, DH.pk, ctx.id!, ctx.subject.userId);
    for (const step of EXIT_STEPS.slice(1)) {
      await tx.$executeRawUnsafe(
        `UPDATE ${step.table} SET "IS_DELETED" = 1, "UPDATED_BY" = $2::text, "UPDATED_ON" = now() WHERE "EMP_ID" = $1::integer AND "IS_DELETED" = 0`,
        ctx.employee.id, String(ctx.subject.userId),
      );
    }
  },
};

const TITLES: Record<string, string> = { exit_gna: 'GNA and Admin', exit_finance: 'Account Finance', exit_facilities: 'Facilities/IT', exit_hr: 'Human Resource' };

function stepScreen(key: keyof typeof exitStepDefs): HubConfig {
  const step = EXIT_STEPS.find((s) => s.key === key)!;
  return {
    ...stepConfig(step, TITLES[key]),
    key,
    defs: exitStepDefs[key],
    listColumns: step.items.map((i) => `${itemValueSql(i)} AS "${i.column}_NM"`).join(', '),
    search: step.items.map((i) => `${i.column}_NM`),
    sorts: [],
  };
}

export const exitStepConfigs = {
  exit_gna: stepScreen('exit_gna'),
  exit_finance: stepScreen('exit_finance'),
  exit_facilities: stepScreen('exit_facilities'),
  exit_hr: stepScreen('exit_hr'),
};
