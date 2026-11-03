import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { USER_STATUS, userStatusId } from '@/lib/auth/userStatus';
import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { ownEmployeeId } from './empList';
import { insertRow, updateRow, type EmployeeRef, type Tx } from './hub/hubEngine';

/**
 * Employee Termination (CI employeeMngt/termination): what an exit record does to the employee, and the
 * resignation request a normal user sends and HR accepts or rejects.
 *
 * Statuses (CI termination_m::updateEmployeeStatus): the employee's latest live record decides the
 * current job's status, the employee's (Current / Former) and, for a Former employee, deactivates their
 * login. CI ran it only when a record was saved with a termination date already reached, and otherwise
 * left it to an outside cron calling a public URL; here it runs on every save and from the list's
 * "Update Employee Statuses" action (for exits whose date has since passed).
 *
 * Behaviour changes: the latest live record rules (CI's UNION picked an arbitrary record and skipped
 * employees with two jobs); editing an older record changes nothing; a resignation not yet accepted (and
 * without a termination date) does not start the notice period; retirement / death / absconding wait
 * for a future termination date (CI made the employee Former at once); the status is the job type's own
 * of the same name when the job is not full time; neither the acting user's nor a system admin's login
 * is deactivated; deleting a record, or rejecting a resignation, takes the job off its notice period.
 *
 * The table has no resignation STATUS column (CI wrote one that PostgreSQL does not have), so a request
 * is "pending" while it is a resignation with a resigned-on date and neither an accepted-on nor a
 * termination date; accepting sets both, rejecting turns it into "Employment Retained" (CI's reason for
 * an employee who stays). Not migrated: CI's e-mails (the app has no mailer; CI's went to a fixed address
 * of one company and, for accept / reject, always to the same wrong employee).
 */
const MENU = 'employeeMngt/termination';
export const REASON_TYPE = 157;
const RESIGNATION = ['ETRRCR', 'ETRRSP', 'ETRO'];
const INVOLUNTARY = ['ETRCNR', 'ETRDS', 'ETRLO'];
const LEFT = ['ETRD', 'ETRPDC', 'ETRRT'];
const NOTICE_MONTHS = 3;

export const reasonCode = (alias: string) => `(SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = ${alias}."EMP_TERMINATION_ID" LIMIT 1)`;

/** A resignation the employee sent (or HR recorded) that nobody has accepted yet. */
export const pendingSql = (alias: string) => `(${alias}."RESIGNED_ON" IS NOT NULL AND ${alias}."RESIGNATION_ACCEPTED_ON" IS NULL
  AND ${alias}."TERMINATION_DATE" IS NULL AND ${reasonCode(alias)} IN (${RESIGNATION.map((c) => `'${c}'`).join(', ')}))`;

/** Every id of the reasons the form treats apart (master rows exist twice): { "ETRER:{id}": true, … }. */
export async function reasonFlags(): Promise<Record<string, boolean>> {
  const rows = await prisma.$queryRaw<Array<{ id: number; code: string }>>`
    SELECT "MSTR_ID" AS id, "MSTR_CD" AS code FROM independent_mst WHERE "TYP_ID" = ${REASON_TYPE} AND "MSTR_CD" IN ('ETRER', 'ETRRJ')`;
  return Object.fromEntries(rows.map((r) => [`${r.code}:${r.id}`, true]));
}

/** CI termination reasons (TYP 157), one per name; Rejoin rows come from Job Detail's rejoin, not this form. */
export async function reasonOptions(): Promise<Array<{ value: number; label: string }>> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT MIN(im."MSTR_ID") AS value, im."MSTR_NM" AS label FROM independent_mst im
    WHERE im."TYP_ID" = ${REASON_TYPE} AND COALESCE(im."IS_DELETED", false) = false AND im."MSTR_CD" IS DISTINCT FROM 'ETRRJ'
    GROUP BY im."MSTR_NM" ORDER BY MIN(im."SEQUENCE") NULLS LAST, im."MSTR_NM"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

// ------------------------------------------------------------------ statuses

interface JobStatus {
  id: number;
  code: string | null;
  name: string;
  parent: number | null;
}

interface CurrentJob {
  id: number;
  status: number | null;
  type: number | null;
  confirmation: string | null;
}

type Outcome = { job: string; former: boolean } | { restore: 'notice' | 'exit' } | null;

/** CI's rule table (first match wins); dates are YYYY-MM-DD. */
function outcomeOf(code: string | null, r: { term: string | null; resigned: string | null; accepted: string | null }, today: string): Outcome {
  if (!code) return null;
  if (code === 'ETRER') return { restore: 'exit' };
  const terminated = !!r.term && r.term < today;
  if (INVOLUNTARY.includes(code)) {
    if (terminated) return { job: 'TRES', former: true };
    return r.resigned && r.resigned <= today ? { job: 'NPES', former: false } : null;
  }
  if (RESIGNATION.includes(code)) {
    if (terminated) return { job: 'REES', former: true };
    return r.resigned && r.resigned <= today && (r.accepted || r.term) ? { job: 'NPES', former: false } : null;
  }
  if (LEFT.includes(code) || code === 'ETRABS') {
    if (r.term && r.term >= today) return null;
    return { job: code === 'ETRABS' ? 'ABES' : 'ESLO', former: true };
  }
  return null;
}

async function jobStatuses(tx: Tx): Promise<JobStatus[]> {
  const rows = await tx.$queryRaw<JobStatus[]>`
    SELECT im."MSTR_ID" AS id, im."MSTR_CD" AS code, im."MSTR_NM" AS name, im."PARENT_MSTR_ID" AS parent
    FROM independent_mst im JOIN common_type ct ON ct."TYP_ID" = im."TYP_ID"
    WHERE ct."TYP_CD" = 'ES' AND COALESCE(im."IS_DELETED", false) = false ORDER BY im."MSTR_ID"`;
  return rows.map((r) => ({ ...r, id: Number(r.id), parent: r.parent ? Number(r.parent) : null }));
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The job status of `code` for the job's type: the type's own status of that name, else CI's (full-time) one. */
function statusFor(statuses: JobStatus[], code: string, type: number | null): number | null {
  const base = statuses.find((s) => s.code === code);
  if (!base) return null;
  if (!type || base.parent === type) return base.id;
  return statuses.find((s) => s.parent === type && sameName(s.name, base.name))?.id ?? base.id;
}

/** The ids of every status named like one of `codes` (any job type). */
function statusesNamed(statuses: JobStatus[], codes: string[]): Set<number> {
  const names = statuses.filter((s) => s.code && codes.includes(s.code)).map((s) => s.name);
  return new Set(statuses.filter((s) => names.some((n) => sameName(n, s.name))).map((s) => s.id));
}

async function currentJob(tx: Tx, employeeId: number): Promise<CurrentJob | null> {
  const [row] = await tx.$queryRaw<Array<{ id: number; status: number | null; type: number | null; confirmation: string | null }>>`
    SELECT "JOB_ID" AS id, "EMP_STATUS_ID" AS status, "EMP_TYPE_ID" AS type, to_char("CONFIRMATION_DATE", 'YYYY-MM-DD') AS confirmation
    FROM job_mst WHERE "EMP_ID" = ${employeeId} AND "IS_DELETED" = 0 ORDER BY "JOB_ID" DESC LIMIT 1`;
  return row ? { id: Number(row.id), status: row.status ? Number(row.status) : null, type: row.type ? Number(row.type) : null, confirmation: row.confirmation } : null;
}

async function dbToday(tx: Tx): Promise<string> {
  const [row] = await tx.$queryRaw<Array<{ d: string }>>`SELECT to_char(current_date, 'YYYY-MM-DD') AS d`;
  return row.d;
}

/** Writes the statuses; returns whether anything changed. */
async function apply(tx: Tx, employeeId: number, actorId: number, job: CurrentJob | null, jobStatus: number | null, employee: 'EMSC' | 'EMSF', deactivate: boolean): Promise<boolean> {
  let changed = 0;
  if (job && jobStatus) {
    changed += await tx.$executeRaw`
      UPDATE job_mst SET "EMP_STATUS_ID" = ${jobStatus}, "UPDATED_BY" = ${actorId}, "UPDATED_ON" = now()
      WHERE "JOB_ID" = ${job.id} AND "EMP_STATUS_ID" IS DISTINCT FROM ${jobStatus}::int`;
  }
  const empStatus = await getMasterId(employee);
  if (empStatus) {
    changed += await tx.$executeRaw`
      UPDATE emp_mst SET "EMP_STATUS_ID" = ${empStatus}, "UPDATED_BY" = ${actorId}, "UPDATED_ON" = now()
      WHERE "EMP_ID" = ${employeeId} AND "EMP_STATUS_ID" IS DISTINCT FROM ${empStatus}::int`;
  }
  if (deactivate) {
    const deactivated = await userStatusId(USER_STATUS.DEACTIVATED);
    changed += await tx.$executeRaw`
      UPDATE user_mst u SET "USER_STATUS_ID" = ${deactivated}, "UPDATED_BY" = ${actorId}, "UPDATED_ON" = now()
      FROM emp_mst em
      WHERE em."EMP_ID" = ${employeeId} AND u."USER_ID" = em."REF_EMP_ID" AND u."USER_ID" <> ${actorId}
        AND u."IS_SYSADMIN" = false AND u."USER_STATUS_ID" IS DISTINCT FROM ${deactivated}::int`;
  }
  return changed > 0;
}

/** The job back from its notice period ('exit': or from an exit status): Confirmed once past the confirmation date, else Probation. */
async function restore(tx: Tx, employeeId: number, actorId: number, from: 'notice' | 'exit', today: string): Promise<boolean> {
  const [job, statuses] = await Promise.all([currentJob(tx, employeeId), jobStatuses(tx)]);
  const leaving = statusesNamed(statuses, from === 'notice' ? ['NPES'] : ['NPES', 'TRES', 'REES', 'ESLO', 'ABES']);
  if (!job?.status || !leaving.has(job.status)) return from === 'exit' ? apply(tx, employeeId, actorId, null, null, 'EMSC', false) : false;
  const back = statusFor(statuses, !job.confirmation || job.confirmation <= today ? 'CFES' : 'PROB', job.type);
  return apply(tx, employeeId, actorId, job, back, 'EMSC', false);
}

/**
 * The statuses the employee's latest live record calls for. `rowId`: only when that record is the latest
 * (an older record being edited changes nothing). Rejoin records leave the statuses to Job Detail.
 */
export async function recomputeEmployeeStatus(tx: Tx, employeeId: number, actorId: number, rowId?: number): Promise<boolean> {
  const [latest] = await tx.$queryRawUnsafe<Array<{ id: number; code: string | null; term: string | null; resigned: string | null; accepted: string | null; rejoin: string | null }>>(
    `SELECT t."TERMINATION_ID" AS id, ${reasonCode('t')} AS code, to_char(t."TERMINATION_DATE", 'YYYY-MM-DD') AS term,
       to_char(t."RESIGNED_ON", 'YYYY-MM-DD') AS resigned, to_char(t."RESIGNATION_ACCEPTED_ON", 'YYYY-MM-DD') AS accepted,
       to_char(t."REJOIN_DATE", 'YYYY-MM-DD') AS rejoin
     FROM emp_termination_dtl t WHERE t."EMP_ID" = $1::integer AND t."IS_DELETED" = 0 ORDER BY t."TERMINATION_ID" DESC LIMIT 1`,
    employeeId,
  );
  if (!latest || (rowId !== undefined && Number(latest.id) !== rowId)) return false;
  if (latest.code === 'ETRRJ' || latest.rejoin) return false;
  const today = await dbToday(tx);
  const outcome = outcomeOf(latest.code, latest, today);
  if (!outcome) return false;
  if ('restore' in outcome) return restore(tx, employeeId, actorId, outcome.restore, today);
  const [job, statuses] = await Promise.all([currentJob(tx, employeeId), jobStatuses(tx)]);
  return apply(tx, employeeId, actorId, job, job ? statusFor(statuses, outcome.job, job.type) : null, outcome.former ? 'EMSF' : 'EMSC', outcome.former);
}

/** A record deleted: the job comes off a notice period it may have started (an exit already made stays). */
export async function afterTerminationDeleted(tx: Tx, employeeId: number, actorId: number): Promise<void> {
  if (await recomputeEmployeeStatus(tx, employeeId, actorId)) return;
  await restore(tx, employeeId, actorId, 'notice', await dbToday(tx));
}

/** CI getPendingMoney: the employee's outstanding loans (by their login user) and advance salary. */
export async function pendingDues(employee: EmployeeRef): Promise<{ loan: number; advance: number }> {
  const [loan] = employee.userId
    ? await prisma.$queryRaw<Array<{ n: string }>>`
        SELECT COALESCE(SUM(lm."TOTAL_AMT_DUE"), 0)::text AS n
        FROM loan_employee le JOIN loan_mst lm ON lm."EMP_ID" = le."LOAN_EMP_ID" AND lm."IS_DELETED" = 0
        WHERE le."IS_DELETED" = 0 AND le."REF_EMP_ID" = ${employee.userId}`
    : [{ n: '0' }];
  const [advance] = await prisma.$queryRaw<Array<{ n: string }>>`
    SELECT COALESCE(SUM(CASE WHEN btrim(a."TOTAL_DUE") ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN btrim(a."TOTAL_DUE")::numeric END), 0)::text AS n
    FROM advance_salary a WHERE a."EMP_ID" = ${employee.id} AND a."IS_DELETED" = 0`;
  return { loan: Number(loan.n), advance: Number(advance.n) };
}

// ------------------------------------------------------------------ resignation / statuses (list actions)

const can = (subject: RequestSubject, action: 'list' | 'update') => menuPolicy(MENU).check(subject, action);

const resignSchema = z.object({ reason: z.string().optional() });
const decideSchema = z.object({ ids: z.array(z.coerce.number().int().positive()).max(500), action: z.enum(['accept', 'reject']) });

const ddmmyyyy = (d: string) => d.split('-').reverse().join('.');

export const terminationService = {
  /** CI sendResignation: a normal user's resignation, as one pending record. */
  async resign(subject: RequestSubject, body: unknown): Promise<{ id: number; message: string }> {
    if (!(await can(subject, 'list'))) throw new ForbiddenError();
    if (subject.adminLevel !== 0) throw new BusinessRuleError('Record the resignation with Add New Employee Termination.');
    const reason = (resignSchema.parse(body ?? {}).reason ?? '').trim();
    if (!reason) throw new ValidationError('Validation failed.', { reason: ['The Reason field is required.'] });
    if (reason.length > 4000) throw new ValidationError('Validation failed.', { reason: ['The Reason field cannot exceed 4000 characters in length.'] });
    const own = await ownEmployeeId(subject);
    if (!own) throw new BusinessRuleError('You do not have an employee record in this brand.', 'NO_EMPLOYEE_RECORD');

    const [employee] = await prisma.$queryRawUnsafe<Array<{ code: string | null; brand: number; oa: number | null; user: number | null; status: string | null }>>(
      `SELECT em."EMP_NBR" AS code, em."OA_BRAND_ID" AS brand, em."OA_ID" AS oa, em."REF_EMP_ID" AS "user",
         (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = em."EMP_STATUS_ID" LIMIT 1) AS status
       FROM emp_mst em WHERE em."EMP_ID" = $1::integer`,
      own,
    );
    if (employee.status === 'EMSF') throw new BusinessRuleError('You are no longer a current employee.');
    const [pending] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM emp_termination_dtl t WHERE t."EMP_ID" = $1::integer AND t."IS_DELETED" = 0 AND ${pendingSql('t')}`,
      own,
    );
    if (pending.n) throw new BusinessRuleError('You have already sent a resignation; it is pending.');
    const resigned = await getMasterId('ETRRSP', { typeId: REASON_TYPE });
    if (!resigned) throw new BusinessRuleError('The termination reason "Resigned" is not configured.');

    const id = await prisma.$transaction(async (tx) => insertRow(tx, 'emp_termination_dtl', 'TERMINATION_ID', {
      EMP_ID: own, EMP_NBR: employee.code, EMP_TERMINATION_ID: resigned, RESIGNED_ON: await dbToday(tx), TERMINATION_COMMENTS: reason,
      OA_ID: employee.oa, OA_BRAND_ID: Number(employee.brand), USER_ID: employee.user ?? subject.userId,
    }, subject.userId));
    return { id, message: 'Your resignation has been sent to HR.' };
  },

  /** CI change_resignation_status/{TRMSA|TRMSR}: accept or reject pending resignations (admins, in scope). */
  async decide(subject: RequestSubject, body: unknown): Promise<{ count: number; message: string }> {
    if (subject.adminLevel === 0 || !(await can(subject, 'update'))) throw new ForbiddenError();
    const { ids, action } = decideSchema.parse(body ?? {});
    const unique = [...new Set(ids)];
    if (!unique.length) throw new BusinessRuleError('Select at least one resignation.');
    const scope = subject.adminLevel === 2 ? 'TRUE' : `em."OA_BRAND_ID" = ${Number(subject.oaBrandId ?? -1)}`;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; emp: number; resigned: string; comments: string | null }>>(
      `SELECT t."TERMINATION_ID" AS id, t."EMP_ID" AS emp, to_char(t."RESIGNED_ON", 'YYYY-MM-DD') AS resigned, t."TERMINATION_COMMENTS" AS comments
       FROM emp_termination_dtl t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
       WHERE t."TERMINATION_ID" = ANY($1::int[]) AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope} AND ${pendingSql('t')}`,
      unique,
    );
    if (rows.length !== unique.length) throw new BusinessRuleError('Only pending resignations can be accepted or rejected.');
    const retained = action === 'reject' ? await getMasterId('ETRER', { typeId: REASON_TYPE }) : null;
    if (action === 'reject' && !retained) throw new BusinessRuleError('The termination reason "Employment Retained" is not configured.');

    await prisma.$transaction(async (tx) => {
      const today = await dbToday(tx);
      const [{ d: lastDay }] = await tx.$queryRaw<Array<{ d: string }>>`
        SELECT to_char(current_date + make_interval(months => ${NOTICE_MONTHS}::int), 'YYYY-MM-DD') AS d`;
      for (const r of rows) {
        const id = Number(r.id);
        if (action === 'accept') {
          await updateRow(tx, 'emp_termination_dtl', 'TERMINATION_ID', id, { RESIGNATION_ACCEPTED_ON: today, TERMINATION_DATE: lastDay }, subject.userId);
        } else {
          const note = `Resignation of ${ddmmyyyy(r.resigned)} rejected on ${ddmmyyyy(today)}.`;
          await updateRow(tx, 'emp_termination_dtl', 'TERMINATION_ID', id, {
            EMP_TERMINATION_ID: retained, RETENTION_DATE: today, RESIGNED_ON: null,
            TERMINATION_COMMENTS: r.comments?.trim() ? `${r.comments.trim()}\n${note}` : note,
          }, subject.userId);
        }
        await recomputeEmployeeStatus(tx, Number(r.emp), subject.userId, id);
      }
    }, { timeout: 60000 });
    const n = rows.length;
    return { count: n, message: action === 'accept' ? `${n === 1 ? 'Resignation' : `${n} resignations`} accepted.` : `${n === 1 ? 'Resignation' : `${n} resignations`} rejected.` };
  },

  /**
   * CI updateEmployeeStatus (a public URL an outside cron called): the statuses every employee in scope
   * should have now, for exits whose date has passed since the record was saved.
   */
  async recompute(subject: RequestSubject): Promise<{ count: number; message: string }> {
    if (subject.adminLevel === 0 || !(await can(subject, 'update'))) throw new ForbiddenError();
    const scope = subject.adminLevel === 2 ? 'TRUE' : `em."OA_BRAND_ID" = ${Number(subject.oaBrandId ?? -1)}`;
    const employees = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT DISTINCT t."EMP_ID" AS id FROM emp_termination_dtl t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
       WHERE t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope} ORDER BY 1`,
    );
    let count = 0;
    for (const e of employees) {
      if (await prisma.$transaction((tx) => recomputeEmployeeStatus(tx, Number(e.id), subject.userId), { timeout: 30000 })) count++;
    }
    return { count, message: count ? `Statuses updated for ${count} employee${count === 1 ? '' : 's'}.` : 'All employee statuses are up to date.' };
  },
};


/** A column of the employee `alias`'s latest live exit record (not a rejoin marker). */
export const latestExitSql = (alias: string, column: string) => `(SELECT x."${column}" FROM emp_termination_dtl x
  WHERE x."EMP_ID" = ${alias}."EMP_ID" AND x."IS_DELETED" = 0 AND x."REJOIN_DATE" IS NULL AND ${reasonCode('x')} IS DISTINCT FROM 'ETRRJ'
  ORDER BY x."TERMINATION_ID" DESC LIMIT 1)`;

/** The employee's date of separation (YYYY-MM-DD): their exit record's, else the one migrated on emp_mst (CI emp_mst_vw). */
export const separationDateSql = (alias: string) => `to_char(COALESCE(${latestExitSql(alias, 'TERMINATION_DATE')},
  CASE WHEN ${alias}."TERMINATION_DATE" > DATE '1950-01-01' THEN ${alias}."TERMINATION_DATE" END), 'YYYY-MM-DD')`;
