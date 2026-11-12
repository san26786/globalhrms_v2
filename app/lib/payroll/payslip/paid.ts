import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';

/**
 * CI emp_sal_component_mst::paid (Salary Report → "Mark as Paid"): the payslips' transaction status. A paid
 * payslip is released to the employee (My Payslips lists only paid ones).
 *
 * Behaviour changes: admins with Payroll Processing's edit grant, payslips in their scope only (CI took any id —
 * an annexure too — from any user); payslips can be marked unpaid again (CI's "Mark as Unpaid" was commented out,
 * so a flag set by mistake could never be cleared); the change is stamped.
 */
const MENU = 'employeeMngt/emp_sal_component_mst';
const schema = z.object({ ids: z.array(z.coerce.number().int().positive()).max(500), paid: z.boolean() });

export async function markPayslipsPaid(subject: RequestSubject, body: unknown): Promise<{ count: number; message: string }> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'update'))) throw new ForbiddenError();
  const { ids, paid } = schema.parse(body ?? {});
  const unique = [...new Set(ids)];
  if (!unique.length) throw new ValidationError('Please select at least one payslip.', { ids: ['Please select at least one payslip.'] });
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `UPDATE emp_basic_sal_mst t SET "TRANSACTION_STATUS" = ${sql.p(paid ? 1 : 0)}::int, "UPDATED_BY" = ${sql.p(subject.userId)}::int, "UPDATED_ON" = now()
     FROM emp_mst em
     WHERE em."EMP_ID" = t."EMP_ID" AND t."EMP_SAL_ID" = ANY(${sql.p(unique)}::int[]) AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0
       AND t."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
       AND ${scope}
     RETURNING t."EMP_SAL_ID" AS id`,
    ...sql.params,
  );
  if (!rows.length) throw new NotFoundError('Record not found.');
  return { count: rows.length, message: paid ? 'Successfully Marked Paid' : 'Successfully Marked Unpaid' };
}
