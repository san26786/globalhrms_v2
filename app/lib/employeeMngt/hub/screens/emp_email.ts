import { BusinessRuleError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { saveEmail, type ContactOwner } from '../../empContacts';
import { empEmailDefs } from '../defs/emp_email';
import { asId, masterName, softDeleteRow, str, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByType } from '../hubOptions';

/**
 * CI employeeMngt/emp_email ("Employee Email"): an employee's e-mail addresses — oa_contact_emails rows
 * of the employee's login user (USER_ID) in the brand, linked to the address through contact_emails /
 * email_address_mst (lib/employeeMngt/empContacts). The primary one is the employee's e-mail
 * (emp_mst.OA_CNTCT_EML_ID, shown by Employee Manager).
 *
 * Behaviour changes: exactly one primary e-mail per employee — saving a non-primary address keeps the
 * current primary (CI cleared every primary, of every brand's employee sharing the code), an employee's
 * first address is primary, the primary cannot be deleted, and emp_mst.OA_CNTCT_EML_ID follows the
 * primary (CI never updated it); editing re-links the row instead of renaming the shared address row;
 * a real duplicate check; an employee without a login user has no contact to link to and is refused.
 */
const ALIVE = 't."IS_EMP" = 1 AND t."IS_DELETED" = 0';
const PRIMARY = `btrim(COALESCE(t."IS_PRIMARY", '0'), ' ''') = '1'`;
const ADDRESS = `(SELECT ea."EMAIL_ADD" FROM contact_emails c JOIN email_address_mst ea ON ea."EMAIL_ADD_ID" = c."EMAIL_ADD_ID"
  WHERE c."CNTCT_EML_ID" = ${asId('t."CNTCT_EML_ID"')} LIMIT 1)`;
const EMAIL_TYPE = 141; // CI EMAILACCTYPE

const owner = (ctx: HubContext): ContactOwner => ({
  userId: ctx.employee.userId ?? 0, empId: ctx.employee.id, oaId: ctx.employee.oaId, oaBrandId: ctx.employee.brand, actorId: ctx.subject.userId,
});

/** One live primary per employee, mirrored in emp_mst.OA_CNTCT_EML_ID. */
async function settlePrimary(tx: Tx, id: number, ctx: HubContext): Promise<void> {
  const { employee } = ctx;
  const [saved] = await tx.$queryRawUnsafe<Array<{ primary: boolean }>>(
    `SELECT ${PRIMARY} AS "primary" FROM oa_contact_emails t WHERE t."OA_CNTCT_EML_ID" = $1::integer`, id);
  if (saved?.primary) {
    await tx.$executeRawUnsafe(
      `UPDATE oa_contact_emails t SET "IS_PRIMARY" = '0', "UPDATED_BY" = $4::integer, "UPDATED_ON" = now()
       WHERE t."USER_ID" = $1::integer AND t."OA_BRAND_ID" = $2::integer AND t."OA_CNTCT_EML_ID" <> $3::integer AND ${PRIMARY}`,
      employee.userId, employee.brand, id, ctx.subject.userId);
  }
  const [current] = await tx.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT t."OA_CNTCT_EML_ID" AS id FROM oa_contact_emails t
     WHERE t."USER_ID" = $1::integer AND t."OA_BRAND_ID" = $2::integer AND ${ALIVE} AND ${PRIMARY}
     ORDER BY t."OA_CNTCT_EML_ID" DESC LIMIT 1`, employee.userId, employee.brand);
  let primaryId = current?.id;
  if (!primaryId) {
    await tx.$executeRawUnsafe(`UPDATE oa_contact_emails SET "IS_PRIMARY" = '1' WHERE "OA_CNTCT_EML_ID" = $1::integer`, id);
    primaryId = id;
  }
  await tx.$executeRaw`UPDATE emp_mst SET "OA_CNTCT_EML_ID" = ${String(primaryId)} WHERE "EMP_ID" = ${employee.id}`;
}

const emailType = (v: string | boolean) => (v ? Number(v) : null);

export const empEmailConfig: HubConfig = {
  key: 'emp_email',
  defs: empEmailDefs,
  table: 'oa_contact_emails',
  pk: 'OA_CNTCT_EML_ID',
  empColumn: null,
  from: `oa_contact_emails t JOIN LATERAL (
    SELECT * FROM emp_mst e WHERE e."REF_EMP_ID" = t."USER_ID" AND e."OA_BRAND_ID" = t."OA_BRAND_ID" AND e."IS_DELETED" = 0
    ORDER BY e."EMP_ID" LIMIT 1) em ON true`,
  alive: ALIVE,
  listColumns: `${ADDRESS} AS "CNTCT_EMAIL", ${masterName('t."EMAIL_TYPE_ID"')} AS "EMAIL_TYP_NM",
    CASE WHEN ${PRIMARY} THEN 'Yes' ELSE 'No' END AS "Is_Primary", 'Yes' AS "IS_EMP"`,
  search: ['CNTCT_EMAIL', 'EMAIL_TYP_NM'],
  sorts: ['CNTCT_EMAIL', 'EMAIL_TYP_NM', 'Is_Primary'],
  bind: { EML_TYP: 'EMAIL_TYPE_ID', is_primary: 'IS_PRIMARY' },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Employee Email', updated: 'Successfully Updated Employee Email', deleted: 'Successfully Deleted' },

  options: async (_subject, _brand, row) => ({
    emailTypes: await keepCurrent(await mastersByType(EMAIL_TYPE), row?.EMAIL_TYPE_ID, masterLabel),
  }),

  async read(row, values) {
    const rows = await prisma.$queryRawUnsafe<Array<{ email: string | null }>>(
      `SELECT ${ADDRESS} AS email FROM oa_contact_emails t WHERE t."OA_CNTCT_EML_ID" = $1::integer`, Number(row.OA_CNTCT_EML_ID));
    values.email = str(rows[0]?.email);
  },

  async validate(v, check, ctx) {
    if (!ctx.employee.userId) {
      check.fail('EMP_ID', 'This employee has no login user, so an e-mail cannot be linked to them.');
      return;
    }
    if (!v.email || check.has('email')) return;
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM oa_contact_emails t
       WHERE t."USER_ID" = $1::integer AND t."OA_BRAND_ID" = $2::integer AND ${ALIVE} AND t."OA_CNTCT_EML_ID" <> $3::integer
         AND lower(${ADDRESS}) = lower($4)`,
      ctx.employee.userId, ctx.employee.brand, ctx.id ?? -1, String(v.email));
    if (rows[0]?.n) check.fail('email', 'This e-mail address is already saved for the employee.');
  },

  async insert(tx, v, ctx) {
    const id = await saveEmail(tx, owner(ctx), String(v.email), { emailType: emailType(v.EML_TYP), primary: !!v.is_primary });
    await settlePrimary(tx, id, ctx);
    return id;
  },

  async update(tx, v, ctx) {
    const id = ctx.id!;
    await saveEmail(tx, owner(ctx), String(v.email), { emailType: emailType(v.EML_TYP), primary: !!v.is_primary, recordId: id });
    await settlePrimary(tx, id, ctx);
  },

  async remove(tx, ctx) {
    if (ctx.existing?.is_primary) throw new BusinessRuleError('The primary e-mail cannot be deleted. Make another e-mail primary first.');
    await softDeleteRow(tx, 'oa_contact_emails', 'OA_CNTCT_EML_ID', ctx.id!, ctx.subject.userId);
  },
};
