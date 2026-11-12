import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { asId, scopeSql, type Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { hubFor } from '@/lib/employeeMngt/hub/registry';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { centsText } from './annexure/ruleMath';

/**
 * CI incentive/incentive list buttons "Mark As Paid" / "Mark As Unpaid" (paid / unpaid): HR's own marker on
 * incentives (nothing reads it). The incentive itself: lib/employeeMngt/hub/screens/incentive.ts.
 *
 * Behaviour changes: admins with the edit grant only, on live records in their scope (CI took any id from
 * any user); the change is stamped (CI wrote no audit columns).
 */
const markSchema = z.object({ ids: z.array(z.coerce.number().int().positive()).max(1000), paid: z.boolean() });

/** CI incentive/paid · unpaid: flag the selected incentives Paid / Unpaid (admins, records in scope). */
export async function markIncentives(subject: RequestSubject, body: unknown): Promise<{ count: number; message: string }> {
  if (subject.adminLevel === 0 || !(await hubFor('incentive').permissions(subject)).update) throw new ForbiddenError();
  const { ids, paid } = markSchema.parse(body ?? {});
  const unique = [...new Set(ids)];
  if (!unique.length) throw new ValidationError('Select at least one record.', { ids: ['Select at least one record.'] });
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `UPDATE incentive t SET "PAID_FLAG" = ${sql.p(paid ? 1 : 0)}::smallint, "UPDATED_BY" = ${sql.p(String(subject.userId))}::text, "UPDATED_ON" = now()
     FROM emp_mst em
     WHERE em."EMP_ID" = ${asId('t."EMP_ID"')} AND t."INCENTIVE_ID" = ANY(${sql.p(unique)}::int[]) AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope}
     RETURNING t."INCENTIVE_ID" AS id`,
    ...sql.params,
  );
  if (!rows.length) throw new NotFoundError('Record not found.');
  return { count: rows.length, message: paid ? 'Successfully Marked Paid' : 'Successfully Marked Unpaid' };
}


// ------------------------------------------------------------------ payroll (Generate Salary)

const monthText = (month: number, year: number) => `${String(month).padStart(2, '0')}/${year}`;

/**
 * CI getIncentiveByEmpId: the month's Incentives / Arrears total (every type, "Pending Deductions" included) — what
 * Generate Salary pays on the payslip, in cents. Behaviour change: deleted incentives are not paid (CI summed them).
 */
export async function incentiveTotal(db: Tx, empId: number, month: number, year: number): Promise<number> {
  const [r] = await db.$queryRaw<Array<{ total: string }>>`
    SELECT COALESCE(SUM(t."AMOUNT"), 0)::text AS total FROM incentive t
    WHERE btrim(t."EMP_ID") = ${String(empId)} AND btrim(t."DATE") = ${monthText(month, year)} AND t."IS_DELETED" = 0`;
  return Math.round(Number(r?.total ?? 0) * 100);
}

/** CI's comment on the arrear a payslip of an employee absent the whole month carries to the next month. */
export const pendingDeductionsComment = (month: number, year: number) => `Pending Deductions of ${String(month).padStart(2, '0')}-${year}`;

const nextMonth = (month: number, year: number) => (month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year });

/**
 * CI incentive_m::insert from generateSalaryDetails: the "Pending Deductions of MM-YYYY" Arrears row of the next month
 * (negative cents). Behaviour change: one row per payslip month — a regeneration replaces it (CI added a copy each time).
 */
export async function upsertPendingDeductions(
  tx: Tx,
  v: { empId: number; month: number; year: number; cents: number; type: number; oa: number; brand: number; user: number; actor: number },
) {
  const next = nextMonth(v.month, v.year);
  const date = monthText(next.month, next.year);
  const comments = pendingDeductionsComment(v.month, v.year);
  const amount = centsText(v.cents);
  const updated = await tx.$executeRaw`
    UPDATE incentive SET "AMOUNT" = ${amount}::numeric, "UPDATED_BY" = ${String(v.actor)}, "UPDATED_ON" = now()
    WHERE btrim("EMP_ID") = ${String(v.empId)} AND btrim("DATE") = ${date} AND btrim("INCENTIVE") = ${String(v.type)}
      AND "COMMENTS" = ${comments} AND "IS_DELETED" = 0`;
  if (updated) return;
  await assertInsertSafe('incentive', 'INCENTIVE_ID');
  await tx.$executeRaw`
    INSERT INTO incentive ("EMP_ID", "INCENTIVE", "AMOUNT", "COMMENTS", "DATE", "PAID_FLAG", "OA_ID", "OA_BRAND_ID", "USER_ID",
      "CREATED_BY", "CREATED_ON", "UPDATED_BY", "UPDATED_ON", "IS_DELETED")
    VALUES (${String(v.empId)}, ${String(v.type)}, ${amount}::numeric, ${comments}, ${date}, 0, ${v.oa}, ${v.brand}, ${v.user},
      ${String(v.actor)}, now(), ${String(v.actor)}, now(), 0)`;
}

/** Payslip delete: the arrear its run carried to the next month goes too, unless already marked paid. */
export async function removePendingDeductions(tx: Tx, v: { empId: number; month: number; year: number; type: number; actor: number }) {
  const next = nextMonth(v.month, v.year);
  await tx.$executeRaw`
    UPDATE incentive SET "IS_DELETED" = 1, "UPDATED_BY" = ${String(v.actor)}, "UPDATED_ON" = now()
    WHERE btrim("EMP_ID") = ${String(v.empId)} AND btrim("DATE") = ${monthText(next.month, next.year)} AND btrim("INCENTIVE") = ${String(v.type)}
      AND "COMMENTS" = ${pendingDeductionsComment(v.month, v.year)} AND "IS_DELETED" = 0 AND "PAID_FLAG" = 0`;
}
