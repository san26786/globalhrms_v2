import * as XLSX from 'xlsx';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { EMAIL_EXPR, SqlBuilder } from '@/lib/employeeMngt/empList';
import { salaryReportFilter } from '@/lib/employeeMngt/hub/screens/salary_report';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';

/**
 * CI emp_sal_component_mst::exportExcel (Salary Report → "Salary Report", bank_transfer_report): the bank's bulk-payment
 * upload sheet "Salary Bank Transfer Report.xlsx" — one row per payslip of the month: Payment Identifier (I: same bank
 * as the brand, N: another bank), net pay, value date (the 10th of the current month), beneficiary, account, e-mail,
 * narration, the brand's debit account, IFSC, account type 11 and the brand's phone.
 *
 * As CI: every employment status (a leaver's last salary is still paid), paid and unpaid unless filtered, the brand's
 * phone as "Mobile No", no RTGS identifier. Behaviour changes: admins with the menu grant only (CI's URL was open to
 * anyone); the filters are the page's current ones (CI froze them when the page opened, and lost the employee after
 * "Select All"); payslips without a bank account or with a net pay of 0 or less are left out and reported (CI wrote
 * blank accounts and negative amounts into the bank file); the narration numbers run 01, 02 … down the sheet.
 */
const MENU = 'employeeMngt/emp_sal_component_mst/viewMonthlySalaryReport';
const FILE = 'Salary Bank Transfer Report.xlsx';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HEADERS = ['Payment Identifier', 'Amount', 'Value Date', 'Beneficiary Name', 'Bank Account Number', 'Email ID of beneficiary', 'Email Body',
  'Debit Account Number', 'CRN (Narration / Remarks)', 'Receiver IFSC', 'Receiver Account type', 'Mobile No'];

interface Row {
  id: number;
  emp: number;
  code: string | null;
  MONTH_N: number;
  YEAR_N: number;
  amount: string;
  beneficiary: string;
  emp_bank: string | null;
  account: string | null;
  ifsc: string | null;
  email: string | null;
  brand_bank: string | null;
  debit_account: string | null;
  mobile: string | null;
}

export interface BankTransferFile {
  name: string;
  data: Buffer;
  excluded: { noAccount: string[]; notPositive: string[] };
}

/** What the Salary Report's toolbar may offer. */
export async function salaryReportOptions(subject: RequestSubject) {
  const admin = subject.adminLevel > 0;
  const [update, list] = await Promise.all([
    admin ? menuPolicy(MENU).check(subject, 'update') : Promise.resolve(false),
    admin ? menuPolicy(MENU).check(subject, 'list') : Promise.resolve(false),
  ]);
  return { permissions: { markPaid: update, bankFile: list && !!subject.oaBrandId } };
}

export async function bankTransferWorkbook(subject: RequestSubject, query: Record<string, string>): Promise<BankTransferFile> {
  if (subject.adminLevel === 0 || !(await menuPolicy(MENU).check(subject, 'list'))) throw new ForbiddenError();
  const brand = subject.oaBrandId ?? null;
  if (!brand) throw new BusinessRuleError('Select a brand first.');
  const emp = query.emp ? Number(query.emp) : null;
  if (emp !== null) {
    const [e] = Number.isInteger(emp) && emp > 0
      ? await prisma.$queryRaw<Array<{ n: number }>>`SELECT 1 AS n FROM emp_mst WHERE "EMP_ID" = ${emp} AND "IS_DELETED" = 0 AND "OA_BRAND_ID" = ${brand}`
      : [];
    if (!e) throw new NotFoundError('Record not found.');
  }

  const sql = new SqlBuilder();
  const brandParam = sql.p(brand);
  const empFilter = emp ? `AND em."EMP_ID" = ${sql.p(emp)}::int` : '';
  const filter = salaryReportFilter(query, sql, { ignoreStatus: true });
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT v.* FROM (
       SELECT t."EMP_SAL_ID" AS id, em."EMP_ID" AS emp, em."EMP_NBR" AS code,
         CASE WHEN t."MONTH" ~ '^\\s*[0-9]{1,2}\\s*$' THEN btrim(t."MONTH")::int END AS "MONTH_N",
         CASE WHEN t."YEAR" ~ '^\\s*[0-9]{4}\\s*$' THEN btrim(t."YEAR")::int END AS "YEAR_N",
         t."TRANSACTION_STATUS" AS "TRANSACTION_STATUS_N", t."EARNED_AMOUNT"::text AS amount,
         btrim(COALESCE(em."EMP_NAME", '') || ' ' || COALESCE(em."EMPLST_NM", '')) AS beneficiary,
         b."BANK_NM" AS emp_bank, b."ACCOUNT_NO" AS account, b."IFSC_CD" AS ifsc,
         ${EMAIL_EXPR} AS email,
         ob."BANK_NAME" AS brand_bank, ob."ACCOUNT_NO" AS debit_account, ob."TELEPHONE"::text AS mobile
       FROM emp_basic_sal_mst t
       JOIN emp_mst em ON em."EMP_ID" = t."EMP_ID"
       JOIN oa_brands ob ON ob."OA_BRAND_ID" = em."OA_BRAND_ID"
       LEFT JOIN LATERAL (SELECT x."BANK_NM", x."ACCOUNT_NO", x."IFSC_CD" FROM bank_dtl x
           WHERE x."EMP_ID" = em."EMP_ID" AND x."IS_PRIMARY" = 1 AND btrim(COALESCE(x."IS_DELETED", '0'), '''') = '0'
           ORDER BY x."BANK_ID" DESC LIMIT 1) b ON true
       WHERE t."IS_DELETED" = 0 AND em."IS_DELETED" = 0 AND em."OA_BRAND_ID" = ${brandParam}::int
         AND t."SAL_TYPE" = (SELECT im."MSTR_ID" FROM independent_mst im WHERE im."MSTR_CD" = 'PRSTPS' ORDER BY im."MSTR_ID" LIMIT 1)
         ${empFilter}
     ) v WHERE ${filter} ORDER BY v.emp, v.id`,
    ...sql.params,
  );

  const excluded: BankTransferFile['excluded'] = { noAccount: [], notPositive: [] };
  const paid = rows.filter((r) => {
    const who = r.code ?? `#${r.emp}`;
    if (!(r.account ?? '').trim()) {
      excluded.noAccount.push(who);
      return false;
    }
    if (!(Number(r.amount) > 0)) {
      excluded.notPositive.push(who);
      return false;
    }
    return true;
  });
  if (!paid.length) throw new NotFoundError('No records found!!');

  const now = new Date();
  const valueDate = `10-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
  const ws: XLSX.WorkSheet = {};
  const put = (col: number, row: number, cell: XLSX.CellObject) => {
    ws[XLSX.utils.encode_cell({ c: col, r: row })] = cell;
  };
  HEADERS.forEach((h, c) => put(c, 0, { t: 's', v: h }));
  paid.forEach((r, i) => {
    const y = i + 1;
    const narration = `salary${MONTHS[r.MONTH_N - 1] ?? ''}${r.YEAR_N}${String(i + 1).padStart(2, '0')}`;
    const mobile = (r.mobile ?? '').trim();
    put(0, y, { t: 's', v: norm(r.brand_bank) !== '' && norm(r.brand_bank) === norm(r.emp_bank) ? 'I' : 'N' });
    put(1, y, { t: 'n', v: Number(r.amount), z: '#.00' });
    put(2, y, { t: 's', v: valueDate });
    put(3, y, { t: 's', v: r.beneficiary });
    put(4, y, { t: 's', v: (r.account ?? '').trim() });
    put(5, y, { t: 's', v: r.email ?? '' });
    put(6, y, { t: 's', v: narration });
    put(7, y, { t: 's', v: r.debit_account ?? '' });
    put(8, y, { t: 's', v: narration });
    put(9, y, { t: 's', v: r.ifsc ?? '' });
    put(10, y, { t: 'n', v: 11 });
    put(11, y, /^\d{1,15}$/.test(mobile) ? { t: 'n', v: Number(mobile), z: '#' } : { t: 's', v: mobile });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: HEADERS.length - 1, r: paid.length } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');
  return { name: FILE, data: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer, excluded };
}
