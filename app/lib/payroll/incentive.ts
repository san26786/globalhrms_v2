import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { SqlBuilder } from '@/lib/employeeMngt/empList';
import { asId, scopeSql } from '@/lib/employeeMngt/hub/hubEngine';
import { hubFor } from '@/lib/employeeMngt/hub/registry';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';

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

