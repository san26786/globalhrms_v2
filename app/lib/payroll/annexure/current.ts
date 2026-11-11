import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { fullName, scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { annexureType, resolvePair } from './pair';

/**
 * CI emp_sal_component_mst/markCurrentAnnexure (Annexure Processing → "Mark Current Annexure"): the selected
 * annexures become their employees' current ones — the annexure payroll pays from.
 *
 * Behaviour changes: admins with the menu's edit grant, annexures in their scope only (CI took any id from any
 * user); the whole annexure is marked — its header of the brand's frequency is the one payroll reads, so marking
 * the yearly row works too (CI marked exactly the row ticked, and a yearly row left payroll without a current
 * annexure; the flag stays on the frequency header, as CI); only the employee's other annexures stop being current (CI cleared their payslips' flag too); one
 * annexure per employee; the change is stamped.
 */
const MENU = 'employeeMngt/emp_sal_component_mst/indexAnnexures';
const schema = z.object({ ids: z.array(z.coerce.number().int().positive()).max(200) });

export async function markCurrentAnnexures(subject: RequestSubject, body: unknown): Promise<{ count: number; message: string }> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'update'))) throw new ForbiddenError();
  const ids = [...new Set(schema.parse(body ?? {}).ids)];
  if (!ids.length) throw new ValidationError('Please select at least one annexure.', { ids: ['Please select at least one annexure.'] });

  // Every id must be a live annexure of an employee in scope.
  const prstax = await annexureType();
  const sql = new SqlBuilder();
  const scope = await scopeSql(subject, sql);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; emp: number; name: string }>>(
    `SELECT t."EMP_SAL_ID" AS id, t."EMP_ID" AS emp, ${fullName('em')} AS name FROM emp_basic_sal_mst t JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
     WHERE t."EMP_SAL_ID" = ANY(${sql.p(ids)}::int[]) AND t."SAL_TYPE" = ${sql.p(prstax)}::int AND t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND ${scope}`,
    ...sql.params,
  );
  if (rows.length !== ids.length) throw new NotFoundError('Annexure not found.');

  await prisma.$transaction(async (tx) => {
    const pairs = await Promise.all(rows.map(async (r) => ({ row: r, pair: (await resolvePair(tx, Number(r.id)))! })));
    const byEmployee = new Map<number, string>();
    for (const { row, pair } of pairs) {
      const key = pair.ids.join(',');
      const seen = byEmployee.get(Number(row.emp));
      if (seen !== undefined && seen !== key) throw new ValidationError(`Select only one annexure per employee (${row.name}).`, { ids: [`Select only one annexure per employee (${row.name}).`] });
      byEmployee.set(Number(row.emp), key);
    }
    for (const { row, pair } of pairs) {
      await tx.$executeRaw`
        UPDATE emp_basic_sal_mst SET "IS_CURRENT" = 0, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "EMP_ID" = ${Number(row.emp)} AND "SAL_TYPE" = ${prstax} AND "IS_CURRENT" = 1 AND "EMP_SAL_ID" <> ALL(${pair.ids}::int[])`;
      // As CI, the header of the brand's frequency carries the flag (payroll reads it); the list shows the pair as current.
      await tx.$executeRaw`
        UPDATE emp_basic_sal_mst SET "IS_CURRENT" = CASE WHEN "EMP_SAL_ID" = ${pair.period ?? pair.yearly} THEN 1 ELSE 0 END,
          "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
        WHERE "EMP_SAL_ID" = ANY(${pair.ids}::int[])`;
    }
  });
  return { count: new Set(rows.map((r) => Number(r.emp))).size, message: 'Successfully Marked Current Annexure' };
}
