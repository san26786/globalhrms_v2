import { BusinessRuleError } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { savePhone } from '../../empContacts';
import { empPhoneDefs } from '../defs/emp_phone';
import { asId, insertRow, masterName, softDeleteRow, str, updateRow, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByCode } from '../hubOptions';
import type { HubValues } from '../hubTypes';

/**
 * CI employeeMngt/emp_phone ("Employee Phone"): an employee's phone numbers (oa_contact_phones rows with
 * the employee's EMP_ID). The primary one is the employee's phone (emp_mst.OA_CNTCT_PHONE_ID, shown by
 * Employee Manager).
 *
 * Behaviour changes: the number is linked through the contact tables like Employee Manager's phone
 * (lib/employeeMngt/empContacts; CI stored the typed digits in CNTCT_PHONE_ID and listed a second,
 * unvalidated "Employee Phone" box — one number now, shown in that column); exactly one primary phone per
 * employee — a non-primary save keeps the current primary (CI cleared the primary of every phone without
 * an organisation contact, in every brand), the first phone is primary, the primary cannot be deleted,
 * and emp_mst.OA_CNTCT_PHONE_ID follows it; 6–15 digits as on Employee Manager (CI: exactly 10); a real
 * duplicate check. An employee without a login user keeps the row without the contact chain.
 */
const ALIVE = 't."IS_EMP" = 1 AND t."IS_DELETED" = 0';
const PRIMARY = `btrim(COALESCE(t."IS_PRIMARY", '0'), ' ''') = '1'`;
/** The number: EMP_PHONE, else the digits CI kept in CNTCT_PHONE_ID, else the linked contact number. */
const NUMBER = `COALESCE(NULLIF(btrim(t."EMP_PHONE"), ''),
  CASE WHEN t."CNTCT_PHONE_ID" ~ '^[0-9]{10,}$' THEN t."CNTCT_PHONE_ID" END,
  (SELECT pn."PHONE_NBR" FROM contact_phones cp JOIN phone_nbr_mst pn ON pn."PHONE_NBR_ID" = cp."PHONE_NBR_ID"
   WHERE cp."CNTCT_PHONE_ID" = ${asId('t."CNTCT_PHONE_ID"')} LIMIT 1))`;

/** One live primary per employee, mirrored in emp_mst.OA_CNTCT_PHONE_ID. */
async function settlePrimary(tx: Tx, id: number, ctx: HubContext): Promise<void> {
  const { employee } = ctx;
  const [saved] = await tx.$queryRawUnsafe<Array<{ primary: boolean; number: string | null }>>(
    `SELECT ${PRIMARY} AS "primary", ${NUMBER} AS number FROM oa_contact_phones t WHERE t."OA_CNTCT_PHONE_ID" = $1::integer`, id);
  if (saved?.primary) {
    await tx.$executeRawUnsafe(
      `UPDATE oa_contact_phones t SET "IS_PRIMARY" = '0', "UPDATED_BY" = $3::integer, "UPDATED_ON" = now()
       WHERE t."EMP_ID" = $1::integer AND t."OA_CNTCT_PHONE_ID" <> $2::integer AND ${PRIMARY}`,
      employee.id, id, ctx.subject.userId);
  }
  const [current] = await tx.$queryRawUnsafe<Array<{ id: number; number: string | null }>>(
    `SELECT t."OA_CNTCT_PHONE_ID" AS id, ${NUMBER} AS number FROM oa_contact_phones t
     WHERE t."EMP_ID" = $1::integer AND ${ALIVE} AND ${PRIMARY} ORDER BY t."OA_CNTCT_PHONE_ID" DESC LIMIT 1`, employee.id);
  let primary = current;
  if (!primary) {
    await tx.$executeRawUnsafe(`UPDATE oa_contact_phones SET "IS_PRIMARY" = '1' WHERE "OA_CNTCT_PHONE_ID" = $1::integer`, id);
    primary = { id, number: saved?.number ?? null };
  }
  // Employee Manager reads a linked phone by its oa_contact_phones id, an employee without a login by the raw number.
  const link = employee.userId ? String(primary.id) : primary.number;
  await tx.$executeRaw`UPDATE emp_mst SET "OA_CNTCT_PHONE_ID" = ${link} WHERE "EMP_ID" = ${employee.id}`;
}

async function save(tx: Tx, v: Record<string, string | boolean>, ctx: HubContext, recordId?: number): Promise<number> {
  const { employee, subject } = ctx;
  const phone = String(v.phone);
  const country = String(v.COUNTRY_CODE);
  const phoneType = v.phone_typ ? Number(v.phone_typ) : null;
  if (employee.userId) {
    return savePhone(tx, { userId: employee.userId, empId: employee.id, oaId: employee.oaId, oaBrandId: employee.brand, actorId: subject.userId },
      phone, country, { phoneType, primary: !!v.is_primary, recordId });
  }
  const data = {
    EMP_ID: employee.id, EMP_PHONE: phone, CNTCT_PHONE_ID: null, OA_CNTCT_ID: null, COUNTRY_CODE: country, PHONE_TYPE: phoneType,
    IS_PRIMARY: v.is_primary ? '1' : '0', IS_EMP: 1, IS_DELETED: 0, OA_ID: employee.oaId, OA_BRAND_ID: employee.brand,
  };
  if (recordId) {
    await updateRow(tx, 'oa_contact_phones', 'OA_CNTCT_PHONE_ID', recordId, data, subject.userId);
    return recordId;
  }
  return insertRow(tx, 'oa_contact_phones', 'OA_CNTCT_PHONE_ID', data, subject.userId);
}

export const empPhoneConfig: HubConfig = {
  key: 'emp_phone',
  defs: empPhoneDefs,
  table: 'oa_contact_phones',
  pk: 'OA_CNTCT_PHONE_ID',
  empColumn: 'EMP_ID',
  alive: ALIVE,
  listColumns: `CASE WHEN ${PRIMARY} THEN 'Yes' ELSE 'No' END AS "Is_Primary", ${NUMBER} AS "EMP_PHONE",
    ${masterName('t."PHONE_TYPE"')} AS "PHONE_TYPE"`,
  search: ['EMP_PHONE', 'PHONE_TYPE'],
  sorts: ['Is_Primary', 'EMP_PHONE', 'PHONE_TYPE'],
  bind: { COUNTRY_CODE: 'COUNTRY_CODE', phone_typ: 'PHONE_TYPE', is_primary: 'IS_PRIMARY' },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Employee Phone', updated: 'Successfully Updated Employee Phone Details', deleted: 'Successfully Deleted' },

  // CI preselected +44 (master 3623, CC44) on the add form.
  defaults: async (): Promise<HubValues> => {
    const cc44 = await getMasterId('CC44');
    return cc44 ? { COUNTRY_CODE: String(cc44) } : {};
  },

  options: async (_subject, _brand, row) => {
    const [codes, types] = await Promise.all([mastersByCode('CTCD'), mastersByCode('PNT')]);
    return {
      countryCodes: await keepCurrent(codes, row?.COUNTRY_CODE, masterLabel),
      phoneTypes: await keepCurrent(types, row?.PHONE_TYPE, masterLabel),
    };
  },

  async read(row, values) {
    const rows = await prisma.$queryRawUnsafe<Array<{ number: string | null }>>(
      `SELECT ${NUMBER} AS number FROM oa_contact_phones t WHERE t."OA_CNTCT_PHONE_ID" = $1::integer`, Number(row.OA_CNTCT_PHONE_ID));
    values.phone = str(rows[0]?.number);
  },

  async validate(v, check, ctx) {
    const phone = String(v.phone);
    if (!phone || check.has('phone')) return;
    if (phone !== ctx.existing?.phone && (!/^\d{6,15}$/.test(phone) || /^0+$/.test(phone))) {
      check.fail('phone', 'The Phone field must be 6 to 15 digits.');
      return;
    }
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM oa_contact_phones t
       WHERE t."EMP_ID" = $1::integer AND ${ALIVE} AND t."OA_CNTCT_PHONE_ID" <> $2::integer AND ${NUMBER} = $3`,
      ctx.employee.id, ctx.id ?? -1, phone);
    if (rows[0]?.n) check.fail('phone', 'This Phone No. is Already Exist For This User');
  },

  async insert(tx, v, ctx) {
    const id = await save(tx, v, ctx);
    await settlePrimary(tx, id, ctx);
    return id;
  },

  async update(tx, v, ctx) {
    await save(tx, v, ctx, ctx.id!);
    await settlePrimary(tx, ctx.id!, ctx);
  },

  async remove(tx, ctx) {
    if (ctx.existing?.is_primary) throw new BusinessRuleError('The primary phone cannot be deleted. Make another phone primary first.');
    await softDeleteRow(tx, 'oa_contact_phones', 'OA_CNTCT_PHONE_ID', ctx.id!, ctx.subject.userId);
  },
};
