import { prisma } from '@/lib/prisma';
import { isIndiaBrand } from '../../empMst';
import { bankDtlDefs } from '../defs/bank_dtl';
import type { HubConfig, Tx } from '../hubEngine';

/**
 * CI employeeMngt/bank_dtl ("Bank Accounts"): an employee's bank accounts (table bank_dtl; payroll pays
 * into the primary one). Not the company accounts of Bank Manager (table bankdetails).
 *
 * Behaviour changes: saving an account clears the other accounts' primary flag only when the saved one
 * is primary (CI cleared them on every save, leaving the employee without a primary account); an
 * employee's only account is primary; India brands need the IFSC code instead of the Sort Code (CI
 * required the Sort Code everywhere); bank / branch / holder names may contain . ' & ( ) - / and the
 * branch address is free text (CI's alpha / alpha-numeric rules rejected "HDFC Bank Ltd." and any
 * address with spaces); the same account number cannot be saved twice for one employee.
 */
const ALIVE = `btrim(COALESCE(t."IS_DELETED", '0'), '''') = '0'`; // varchar; migrated rows hold '0' or the quoted default
const NAME = /^[a-z .'&()\-/]+$/i;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

async function otherLiveAccounts(tx: Tx, empId: number, id: number) {
  const [row] = await tx.$queryRawUnsafe<Array<{ n: number; primary: number }>>(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE t."IS_PRIMARY" = 1)::int AS "primary"
     FROM bank_dtl t WHERE t."EMP_ID" = $1::integer AND t."BANK_ID" <> $2::integer AND ${ALIVE}`,
    empId,
    id,
  );
  return row;
}

export const bankDtlConfig: HubConfig = {
  key: 'bank_dtl',
  defs: bankDtlDefs,
  table: 'bank_dtl',
  pk: 'BANK_ID',
  empColumn: 'EMP_ID',
  alive: ALIVE,
  listColumns: `t."BANK_NM", t."BRANCH_NM", t."BRANCH_ADDRESS", t."IFSC_CD", t."SORT_CD", t."ACCOUNT_NO", t."ACCOUNT_HOLDER_NM", t."IS_PRIMARY"`,
  search: ['BANK_NM', 'BRANCH_NM', 'IFSC_CD', 'SORT_CD', 'ACCOUNT_NO', 'ACCOUNT_HOLDER_NM'],
  sorts: ['BANK_NM', 'BRANCH_NM', 'ACCOUNT_HOLDER_NM', 'IS_PRIMARY'],
  bind: {
    bankNm: 'BANK_NM', branchNm: 'BRANCH_NM', branchAddress: 'BRANCH_ADDRESS', AccholderNm: 'ACCOUNT_HOLDER_NM',
    sortCd: 'SORT_CD', AccNo: 'ACCOUNT_NO', ifscCd: 'IFSC_CD', isPrimary: 'IS_PRIMARY',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Bank Account Detail', updated: 'Successfully Updated Bank Account', deleted: 'Successfully Deleted' },

  flags: async (brand) => ({ india: brand ? await isIndiaBrand(brand) : false }),

  async validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    for (const [name, label] of [['bankNm', 'Bank Name'], ['branchNm', 'Branch Name'], ['AccholderNm', 'Account Holder Name']] as const) {
      const value = String(v[name]);
      if (value && changed(name) && !NAME.test(value)) check.fail(name, `The ${label} field may only contain letters, spaces and . ' & ( ) - /`);
    }
    const account = String(v.AccNo);
    if (account && changed('AccNo') && (!/^\d+$/.test(account) || /^0+$/.test(account))) {
      check.fail('AccNo', 'The Account No field must only contain digits and must be greater than zero.');
    }
    v.ifscCd = String(v.ifscCd).toUpperCase();
    const ifsc = v.ifscCd;
    if (ifsc && changed('ifscCd')) {
      if (ctx.flags.india && !IFSC.test(ifsc)) check.fail('ifscCd', 'Enter a valid 11-character IFSC code (e.g. HDFC0001234).');
      else if (!/^[A-Z0-9]+$/.test(ifsc)) check.fail('ifscCd', 'The IFSC Code field may only contain alpha-numeric characters.');
    }
    const sort = String(v.sortCd);
    if (sort && changed('sortCd') && !/^[a-z0-9\- ]+$/i.test(sort)) check.fail('sortCd', 'The Sort Code field may only contain alpha-numeric characters.');

    if (account && !check.has('AccNo')) {
      const [dup] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM bank_dtl t
         WHERE t."EMP_ID" = $1::integer AND t."ACCOUNT_NO" = $2 AND t."BANK_ID" <> $3::integer AND ${ALIVE}`,
        ctx.employee.id,
        account,
        ctx.id ?? -1,
      );
      if (dup.n) check.fail('AccNo', 'This account number is already saved for the employee.');
    }
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),

  /** One primary account per employee — payroll pays into it. */
  async afterWrite(tx, id, v, ctx) {
    const others = await otherLiveAccounts(tx, ctx.employee.id, id);
    if (v.isPrimary) {
      await tx.$executeRawUnsafe(
        `UPDATE bank_dtl SET "IS_PRIMARY" = 0, "UPDATED_BY" = $3::integer, "UPDATEDON" = now()
         WHERE "EMP_ID" = $1::integer AND "BANK_ID" <> $2::integer AND "IS_PRIMARY" = 1`,
        ctx.employee.id,
        id,
        ctx.subject.userId,
      );
    } else if (others.n === 0) {
      await tx.$executeRawUnsafe(`UPDATE bank_dtl SET "IS_PRIMARY" = 1 WHERE "BANK_ID" = $1::integer`, id);
    }
  },
};
