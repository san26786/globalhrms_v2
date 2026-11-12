import type { Tx } from '@/lib/employeeMngt/hub/hubEngine';
import { prisma } from '@/lib/prisma';

/**
 * CI period_mst_m::getFinancialYearByDateForBrand: the brand's financial year (period type OPTFY) holding the 1st of
 * the month. Several periods overlap in the live data; CI's unordered row() took the lowest id, which is also the one
 * the benefit rules are attached to. Shared by the annexure generator (P2) and the payroll run (P3).
 */
export interface FinancialYear {
  id: number;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  name: string | null;
}

export async function findFinancialYear(brand: number, month: number, year: number, db: Tx = prisma): Promise<FinancialYear | null> {
  const [fy] = await db.$queryRaw<Array<{ id: number; start: string; end: string; name: string | null }>>`
    SELECT p."PERIOD_ID" AS id, to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS start, to_char(p."PERIOD_END_DATE", 'YYYY-MM-DD') AS "end",
      p."FISCAL_PERIOD_DESC" AS name
    FROM period_mst p
    WHERE p."OA_BRAND_ID" = ${brand} AND p."IS_DELETED" = 0
      AND p."PERIOD_TYPE_ID" = (SELECT "MSTR_ID" FROM independent_mst WHERE "MSTR_CD" = 'OPTFY' ORDER BY "MSTR_ID" LIMIT 1)
      AND make_date(${year}::int, ${month}::int, 1) BETWEEN p."PERIOD_START_DATE" AND p."PERIOD_END_DATE"
    ORDER BY p."PERIOD_ID" LIMIT 1`;
  return fy ? { id: Number(fy.id), start: fy.start, end: fy.end, name: fy.name } : null;
}
