import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { hubFor } from '@/lib/employeeMngt/hub/registry';
import { syncAdvanceTotals } from '@/lib/employeeMngt/hub/screens/advance_salary';
import { ForbiddenError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { parseId } from '@/lib/systmMngt/shared';

/**
 * CI advance_salary edit form's repayment grid ("Date" / "Repayment Amount" / "Payment Status"): an
 * advance's instalments and their Paid ticks. HR ticks an instalment once its salary has deducted it;
 * while CI payroll is in use an unticked instalment is what it deducts. The advance itself:
 * lib/employeeMngt/hub/screens/advance_salary.ts.
 *
 * Behaviour changes: only the advance's own live instalments can be ticked, by admins who may edit the
 * advance (CI took any repayment id from the post); the totals follow the ticks.
 */
export interface Repayment {
  id: number;
  monthYear: string;
  amount: string;
  paid: boolean;
}

export interface RepaymentSchedule {
  rows: Repayment[];
  totalPaid: string;
  totalDue: string;
  canEdit: boolean;
}

const saveSchema = z.object({ paid: z.record(z.string(), z.boolean()) });

async function schedule(subject: RequestSubject, id: number): Promise<RepaymentSchedule> {
  const rows = await prisma.$queryRaw<Array<{ id: number; month: string; amount: string; paid: number | null }>>`
    SELECT "REPAYMENT_ID" AS id, "MONTH_YEAR" AS month, "AMOUNT" AS amount, "PAID" AS paid FROM advance_salary_repayment
    WHERE "ADVANCE_SAL_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "REPAYMENT_ID"`;
  const [totals] = await prisma.$queryRaw<Array<{ paid: string; due: string }>>`
    SELECT "TOTAL_PAID" AS paid, "TOTAL_DUE" AS due FROM advance_salary WHERE "ADVANCE_SALARY_ID" = ${id}`;
  const perms = await hubFor('advance_salary').permissions(subject);
  return {
    rows: rows.map((r) => ({ id: Number(r.id), monthYear: r.month, amount: r.amount, paid: Number(r.paid) === 1 })),
    totalPaid: totals?.paid ?? '0',
    totalDue: totals?.due ?? '0',
    canEdit: perms.update,
  };
}

export const advanceRepaymentService = {
  async list(subject: RequestSubject, rawId: string): Promise<RepaymentSchedule> {
    await hubFor('advance_salary').get(subject, rawId); // grant + scope (404 outside it)
    return schedule(subject, parseId(rawId));
  },

  async save(subject: RequestSubject, rawId: string, body: unknown): Promise<RepaymentSchedule & { message: string }> {
    const hub = hubFor('advance_salary');
    await hub.get(subject, rawId);
    if (!(await hub.permissions(subject)).update) throw new ForbiddenError();
    const id = parseId(rawId);
    const { paid } = saveSchema.parse(body ?? {});
    const ids = Object.keys(paid).map(Number);
    const own = new Set((await schedule(subject, id)).rows.map((r) => r.id));
    if (!ids.length || ids.some((r) => !own.has(r))) throw new ValidationError('Select a valid repayment.', { paid: ['Select a valid repayment.'] });

    await prisma.$transaction(async (tx) => {
      for (const r of ids) {
        await tx.$executeRaw`
          UPDATE advance_salary_repayment SET "PAID" = ${paid[String(r)] ? 1 : 0}, "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now()
          WHERE "REPAYMENT_ID" = ${r} AND "ADVANCE_SAL_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0 AND "PAID" IS DISTINCT FROM ${paid[String(r)] ? 1 : 0}::smallint`;
      }
      await syncAdvanceTotals(tx, id);
      await tx.$executeRaw`UPDATE advance_salary SET "UPDATED_BY" = ${String(subject.userId)}, "UPDATED_ON" = now() WHERE "ADVANCE_SALARY_ID" = ${id}`;
    });
    return { ...(await schedule(subject, id)), message: 'Successfully Updated Advance Salary' };
  },
};

/**
 * CI getAdvanceSalaryByDate / getAdvanceSalRepaymentByDate (Generate Salary's "Advance Salary" / "Advance Repayment"):
 * the advances paid out in the month and the unpaid instalments due in it, in cents. Behaviour changes: every
 * advance / instalment of the month counts (CI took the first row only) and deleted advances do not.
 */
export async function advanceSalaryPayrollInputs(db: Tx, empId: number, month: number, year: number): Promise<{ advance: number; repayment: number }> {
  const monthYear = `${String(month).padStart(2, '0')}/${year}`;
  const [r] = await db.$queryRaw<Array<{ advance: string; repayment: string }>>`
    SELECT
      (SELECT COALESCE(SUM(round(btrim(a."AMOUNT")::numeric, 2)), 0) FROM advance_salary a
       WHERE a."EMP_ID" = ${empId} AND btrim(a."MONTH_YEAR") = ${monthYear} AND a."IS_DELETED" = 0 AND btrim(a."AMOUNT") ~ '^[0-9]+(\.[0-9]+)?$')::text AS advance,
      (SELECT COALESCE(SUM(round(btrim(r."AMOUNT")::numeric, 2)), 0) FROM advance_salary_repayment r
       JOIN advance_salary a ON a."ADVANCE_SALARY_ID" = r."ADVANCE_SAL_ID"
       WHERE a."EMP_ID" = ${empId} AND a."IS_DELETED" = 0 AND COALESCE(r."IS_DELETED", 0) = 0 AND COALESCE(r."PAID", 0) = 0
         AND btrim(r."MONTH_YEAR") = ${monthYear} AND btrim(r."AMOUNT") ~ '^[0-9]+(\.[0-9]+)?$')::text AS repayment`;
  return { advance: Math.round(Number(r?.advance ?? 0) * 100), repayment: Math.round(Number(r?.repayment ?? 0) * 100) };
}
