import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { contactPhoneLink, writeOrgPhone } from '../../empContacts';
import { emergencyContactDtlDefs } from '../defs/emergency_contact_dtl';
import { asId, insertRow, isDate, masterName, str, today, updateRow, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel, mastersByCode } from '../hubOptions';
import { NAME, relativeOf, relativeOptions, saveRelative } from '../relatives';

/**
 * CI employeeMngt/emergency_contact_dtl ("Emergency Contacts"): who to call for an employee (table
 * emergency_contact_dtl). The person is a relative contact (lib/employeeMngt/hub/relatives); their phone,
 * tel and office numbers are linked to that contact through the phone tables, the columns holding the
 * oa_contact_phones ids; the e-mail is kept as text, as CI did.
 *
 * Behaviour changes: the form saves (CI's posted field names did not match its validation, so saving
 * always failed with "First Name is required"); the relative's numbers are linked to the relative —
 * CI linked them (and the e-mail) to the logged-in user's own contact, demoting their primary phone and
 * e-mail and taking over other people's phone rows with the same number; names may contain spaces,
 * apostrophes and hyphens; numbers are 6–15 digits (CI: 10–15, and "+" or "." slipped through);
 * delete is a soft delete (CI's row icon hard-deleted); changing the relation updates only this
 * employee's live dependent record for the same person.
 */
const RELATION = 160; // CI CONTACTRELATIONTYPEMST
const PHONES = [
  { field: 'emergContactMobileId', country: 'MOBILE_COUNTRY_CODE', column: 'EMERG_CONTACT_MOBILE_ID', label: 'Phone Number' },
  { field: 'emergContactTelId', country: 'TEL_COUNTRY_CODE', column: 'EMERG_CONTACT_TEL_ID', label: 'Tel Number' },
  { field: 'emergContactOffnoId', country: 'OFFICE_COUNTRY_CODE', column: 'EMERG_CONTACT_OFFNO_ID', label: 'Office Number' },
] as const;

/** The number behind a phone-id column (oa_contact_phones), or the raw number some rows hold. */
const number = (column: string) => `COALESCE(
  (SELECT COALESCE(NULLIF(btrim(ocp."EMP_PHONE"), ''),
     (SELECT pn."PHONE_NBR" FROM contact_phones cp JOIN phone_nbr_mst pn ON pn."PHONE_NBR_ID" = cp."PHONE_NBR_ID"
      WHERE cp."CNTCT_PHONE_ID" = ${asId('ocp."CNTCT_PHONE_ID"')} LIMIT 1))
   FROM oa_contact_phones ocp
   WHERE ocp."OA_CNTCT_PHONE_ID" = CASE WHEN t."${column}" ~ '^\\s*[0-9]{1,9}\\s*$' THEN btrim(t."${column}")::bigint END LIMIT 1),
  CASE WHEN t."${column}" ~ '^\\s*\\+?[0-9 ]{10,}\\s*$' THEN btrim(t."${column}") END)`;
const fullNumber = (country: string, column: string) =>
  `NULLIF(btrim(COALESCE(${masterName(`t."${country}"`)}, '') || ' ' || COALESCE(${number(column)}, '')), '')`;
/** The e-mail: the address CI stored, or one an old row links through oa_contact_emails. */
const EMAIL = `CASE WHEN t."EMERG_CONTACT_EMAIL_ID" LIKE '%@%' THEN t."EMERG_CONTACT_EMAIL_ID" ELSE
  (SELECT ea."EMAIL_ADD" FROM oa_contact_emails oce
     JOIN contact_emails ce ON ce."CNTCT_EML_ID" = ${asId('oce."CNTCT_EML_ID"')}
     JOIN email_address_mst ea ON ea."EMAIL_ADD_ID" = ce."EMAIL_ADD_ID"
   WHERE oce."OA_CNTCT_EML_ID" = ${asId('t."EMERG_CONTACT_EMAIL_ID"')} LIMIT 1) END`;

async function save(tx: Tx, v: Record<string, string | boolean>, ctx: HubContext): Promise<number> {
  const { employee, subject } = ctx;
  const dob = String(v.DOB) || null;
  const { orgContactId, contactId } = await saveRelative(tx, ctx, {
    orgContactId: v.emergContactId ? Number(v.emergContactId) : null,
    firstName: String(v.firstName), lastName: String(v.lastName), dob, emergency: true,
  });
  const owner = { oaId: employee.oaId, oaBrandId: employee.brand, actorId: subject.userId, userId: employee.userId };
  const phoneType = await getMasterId('PNTCL');
  const data: Record<string, string | number | null> = {
    EMP_ID: employee.id, EMERG_CONTACT_ID: orgContactId, EMERG_CONTACT_RELATION_TYPE_ID: Number(v.emergContactRelationTypeId),
    EMERG_CONTACT_EMAIL_ID: String(v.emergContactEmailId), First_name: String(v.firstName), Last_name: String(v.lastName), DOB: dob,
    OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId,
  };
  for (const p of PHONES) {
    const phone = String(v[p.field]);
    const country = String(v[p.country]);
    if (!phone) {
      data[p.column] = null;
      data[p.country] = null;
      continue;
    }
    const linkId = await contactPhoneLink(tx, owner, contactId, phone, country);
    const id = await writeOrgPhone(tx, owner, {
      orgContactId, linkId, phone, countryCode: country, phoneType: phoneType ? String(phoneType) : null, primary: '0', isEmp: 0, empId: null,
    });
    data[p.column] = String(id);
    data[p.country] = country || null;
  }
  if (!ctx.id) return insertRow(tx, 'emergency_contact_dtl', 'EMERGENCY_CONTACT_DTL_ID', data, subject.userId);
  await updateRow(tx, 'emergency_contact_dtl', 'EMERGENCY_CONTACT_DTL_ID', ctx.id, data, subject.userId);
  // CI kept the relation of a person who is also a dependent in step.
  await tx.$executeRaw`
    UPDATE dependent_dtl SET "RELATION_TYPE_ID" = ${Number(v.emergContactRelationTypeId)}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
    WHERE "OA_DEP_CNTCTS_ID" = ${orgContactId} AND "EMP_ID" = ${employee.id} AND "IS_DELETED" = 0`;
  return ctx.id;
}

export const emergencyContactDtlConfig: HubConfig = {
  key: 'emergency_contact_dtl',
  defs: emergencyContactDtlDefs,
  table: 'emergency_contact_dtl',
  pk: 'EMERGENCY_CONTACT_DTL_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT NULLIF(btrim(COALESCE(cm."CNTCT_FRST_NM", '') || ' ' || COALESCE(cm."CNTCT_LST_NM", '')), '')
      FROM oa_contacts oc JOIN contact_mst cm ON cm."CNTCT_ID" = oc."CNTCT_ID" WHERE oc."OA_CNTCTS_ID" = t."EMERG_CONTACT_ID" LIMIT 1) AS "EMRG_CNTCT_NM",
    ${masterName('t."EMERG_CONTACT_RELATION_TYPE_ID"')} AS "EMERG_CONTACT_RELATION_TYPE_NM",
    ${fullNumber('MOBILE_COUNTRY_CODE', 'EMERG_CONTACT_MOBILE_ID')} AS "FULL_PHONE_NBR",
    ${fullNumber('OFFICE_COUNTRY_CODE', 'EMERG_CONTACT_OFFNO_ID')} AS "FULL_OFFICE_NBR",
    ${fullNumber('TEL_COUNTRY_CODE', 'EMERG_CONTACT_TEL_ID')} AS "FULL_TEL_NBR"`,
  search: ['EMRG_CNTCT_NM', 'EMERG_CONTACT_RELATION_TYPE_NM', 'FULL_PHONE_NBR'],
  sorts: ['EMRG_CNTCT_NM', 'EMERG_CONTACT_RELATION_TYPE_NM'],
  bind: {
    emergContactId: 'EMERG_CONTACT_ID', emergContactRelationTypeId: 'EMERG_CONTACT_RELATION_TYPE_ID', firstName: 'First_name', lastName: 'Last_name',
    MOBILE_COUNTRY_CODE: 'MOBILE_COUNTRY_CODE', TEL_COUNTRY_CODE: 'TEL_COUNTRY_CODE', OFFICE_COUNTRY_CODE: 'OFFICE_COUNTRY_CODE', DOB: 'DOB',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Emergency Contact Detail', updated: 'Successfully Updated Emergency Contact Detail', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => {
    const [relations, codes] = await Promise.all([brandMasters({ id: RELATION }, brand), mastersByCode('CTCD')]);
    let countryCodes = codes;
    for (const p of PHONES) countryCodes = await keepCurrent(countryCodes, row?.[p.country], masterLabel);
    return { relations: await keepCurrent(relations, row?.EMERG_CONTACT_RELATION_TYPE_ID, masterLabel), countryCodes };
  },

  async employeeOptions(employee, row) {
    const { list, details } = await relativeOptions(employee, row?.EMERG_CONTACT_ID);
    return { options: { relatives: list }, extras: { relatives: { ...details } } };
  },

  async read(row, values) {
    const person = row.EMERG_CONTACT_ID ? await relativeOf(Number(row.EMERG_CONTACT_ID)) : null;
    if (person?.first) values.firstName = person.first;
    if (person?.last) values.lastName = person.last;
    if (person?.dob) values.DOB = person.dob;
    const [stored] = await prisma.$queryRawUnsafe<Array<Record<string, string | null>>>(
      `SELECT ${number('EMERG_CONTACT_MOBILE_ID')} AS "emergContactMobileId", ${number('EMERG_CONTACT_TEL_ID')} AS "emergContactTelId",
              ${number('EMERG_CONTACT_OFFNO_ID')} AS "emergContactOffnoId", ${EMAIL} AS "emergContactEmailId"
       FROM emergency_contact_dtl t WHERE t."EMERGENCY_CONTACT_DTL_ID" = $1::integer`,
      Number(row.EMERGENCY_CONTACT_DTL_ID));
    for (const key of ['emergContactMobileId', 'emergContactTelId', 'emergContactOffnoId', 'emergContactEmailId']) values[key] = str(stored?.[key]);
  },

  async validate(v, check, ctx) {
    for (const [name, label] of [['firstName', 'First Name'], ['lastName', 'Last Name']] as const) {
      if (v[name] && !check.has(name) && !NAME.test(String(v[name]))) check.fail(name, `The ${label} field may only contain letters, spaces, apostrophes and hyphens.`);
    }
    for (const p of PHONES) {
      const phone = String(v[p.field]);
      if (!phone || check.has(p.field) || phone === ctx.existing?.[p.field]) continue;
      if (!/^\d{6,15}$/.test(phone) || /^0+$/.test(phone)) check.fail(p.field, `The ${p.label} field must be 6 to 15 digits.`);
      else if (!v[p.country]) check.fail(p.country, 'Select the country code of the number.');
    }
    const dob = String(v.DOB);
    if (dob && isDate(dob) && (dob < '1900-01-01' || dob > today())) check.fail('DOB', 'Enter a date of birth between 1900 and today.');

    const contact = Number(v.emergContactId);
    if (contact && !check.has('emergContactId')) {
      const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM emergency_contact_dtl
        WHERE "EMP_ID" = ${ctx.employee.id} AND "EMERG_CONTACT_ID" = ${contact} AND "IS_DELETED" = 0 AND "EMERGENCY_CONTACT_DTL_ID" <> ${ctx.id ?? -1}`;
      if (dup.n) check.fail('emergContactId', 'Record already exists');
    }
  },

  insert: (tx, v, ctx) => save(tx, v, ctx),
  update: async (tx, v, ctx) => {
    await save(tx, v, ctx);
  },
};
