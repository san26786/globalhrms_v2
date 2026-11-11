import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';

/**
 * An annexure is two emp_basic_sal_mst headers (SAL_TYPE PRSTAX): the yearly one (PAY_FREQUENCY PFYLY) and one
 * of the brand's pay frequency, inserted one after the other — nothing links them but adjacent ids with the
 * same employee, month, year and effective date. A header without such a partner is a single (legacy).
 */
export interface AnnexurePair {
  employeeId: number;
  /** The yearly header (null for a single of another frequency). */
  yearly: number | null;
  /** The header of the brand's pay frequency — the one payroll uses (null for a yearly single). */
  period: number | null;
  ids: number[];
}

export const annexureType = async () => {
  const id = await getMasterId('PRSTAX');
  if (!id) throw new BusinessRuleError('The annexure salary type (PRSTAX) is not configured.');
  return id;
};

/** The pair the live annexure header `id` belongs to, or null when it is not one. */
export async function resolvePair(tx: Tx, id: number): Promise<AnnexurePair | null> {
  const prstax = await annexureType();
  const rows = await tx.$queryRaw<Array<{ id: number; emp: number; yearly: boolean; self: boolean }>>`
    WITH x AS (SELECT * FROM emp_basic_sal_mst WHERE "EMP_SAL_ID" = ${id} AND "SAL_TYPE" = ${prstax} AND "IS_DELETED" = 0)
    SELECT p."EMP_SAL_ID" AS id, p."EMP_ID" AS emp, p."EMP_SAL_ID" = x."EMP_SAL_ID" AS self,
      (SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID" = p."PAY_FREQUENCY_ID" LIMIT 1) = 'PFYLY' AS yearly
    FROM emp_basic_sal_mst p, x
    WHERE p."EMP_ID" = x."EMP_ID" AND p."SAL_TYPE" = x."SAL_TYPE" AND p."IS_DELETED" = 0
      AND p."MONTH" IS NOT DISTINCT FROM x."MONTH" AND p."YEAR" IS NOT DISTINCT FROM x."YEAR"
      AND p."EFFECTIVE_DATE" IS NOT DISTINCT FROM x."EFFECTIVE_DATE"
      AND p."EMP_SAL_ID" BETWEEN x."EMP_SAL_ID" - 1 AND x."EMP_SAL_ID" + 1
    ORDER BY p."EMP_SAL_ID"`;
  const self = rows.find((r) => r.self);
  if (!self) return null;
  // The partner: the next id when this is the yearly header, else the previous one (then the other side).
  const partner = self.yearly
    ? rows.find((r) => Number(r.id) === id + 1 && !r.yearly) ?? rows.find((r) => Number(r.id) === id + 1)
    : rows.find((r) => Number(r.id) === id - 1 && r.yearly) ?? rows.find((r) => Number(r.id) === id + 1 && r.yearly);
  const members = [self, ...(partner ? [partner] : [])].sort((a, b) => Number(a.id) - Number(b.id));
  // A brand paid yearly has two yearly headers: the lower id is the yearly one.
  const yearly = members.find((m) => m.yearly) ?? null;
  const period = members.find((m) => m !== yearly) ?? null;
  return {
    employeeId: Number(self.emp),
    yearly: yearly ? Number(yearly.id) : null,
    period: period ? Number(period.id) : null,
    ids: members.map((m) => Number(m.id)),
  };
}
