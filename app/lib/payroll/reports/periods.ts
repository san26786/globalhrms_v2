import { BusinessRuleError, NotFoundError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { findFinancialYear } from '../financialYear';

/**
 * The "Financial Year" choices of the payroll reports (CI period_mst_m getAllPeriodDetails / getPeriodByDateAndCode):
 * the brand's financial-year periods, newest first, labelled with their dates (several share a name).
 *
 * Behaviour changes: closed years are listed too (CI hid them, so 2018–2021 payslips could not be reported); periods
 * whose end is before their start (test rows) are left out; a report covers the months whose 1st lies in the period,
 * however many there are (CI added an always-empty month for a period starting mid-month and broke past 12 months).
 */
export interface ReportFy {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (iso: string) => iso.split('-').reverse().join('-');

export async function reportFinancialYears(brand: number): Promise<ReportFy[]> {
  const rows = await prisma.$queryRaw<Array<{ id: number; name: string | null; start: string; end: string }>>`
    SELECT p."PERIOD_ID" AS id, p."FISCAL_PERIOD_DESC" AS name,
      to_char(p."PERIOD_START_DATE", 'YYYY-MM-DD') AS start, to_char(p."PERIOD_END_DATE", 'YYYY-MM-DD') AS "end"
    FROM period_mst p
    WHERE p."PERIOD_TYPE_ID" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'OPTFY' ORDER BY im."MSTR_ID" LIMIT 1)
      AND p."IS_DELETED" = 0 AND p."OA_BRAND_ID" = ${brand}
      AND p."PERIOD_START_DATE" IS NOT NULL AND p."PERIOD_END_DATE" IS NOT NULL AND p."PERIOD_START_DATE" <= p."PERIOD_END_DATE"
    ORDER BY p."PERIOD_START_DATE" DESC, p."PERIOD_ID" ASC`;
  return rows.map((r) => {
    const name = r.name?.trim() || `Period #${r.id}`;
    return { id: Number(r.id), name, start: r.start, end: r.end, label: `${name} (${dmy(r.start)} – ${dmy(r.end)})` };
  });
}

/** The year asked for (one of the brand's), else the one holding today's month (CI's default), else the newest. */
export async function resolveFy(brand: number, raw?: number | null): Promise<ReportFy> {
  const years = await reportFinancialYears(brand);
  if (raw) {
    const fy = years.find((y) => y.id === raw);
    if (!fy) throw new NotFoundError('Record not found.');
    return fy;
  }
  if (!years.length) throw new BusinessRuleError('No financial year is set up for this brand.');
  const now = new Date();
  const current = await findFinancialYear(brand, now.getMonth() + 1, now.getFullYear());
  return years.find((y) => y.id === current?.id) ?? years[0];
}

/** The months whose 1st day lies in the period: { key 'YYYY-MM', label 'Apr-2026' }. */
export function fyMonths(start: string, end: string): Array<{ key: string; label: string }> {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let y = sy;
  let m = sd === 1 ? sm : sm + 1;
  if (m > 12) { m = 1; y++; }
  const out: Array<{ key: string; label: string }> = [];
  while (y * 12 + m <= ey * 12 + em) {
    out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]}-${y}` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
