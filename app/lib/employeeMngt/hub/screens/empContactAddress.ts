import { prisma } from '@/lib/prisma';
import { contactOf } from '../../empContacts';
import { empContactAddressDefs } from '../defs/empContactAddress';
import { asId, insertRow, str, updateRow, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel, mastersByType } from '../hubOptions';

/**
 * CI employeeMngt/empContactAddress ("Address"): an employee's addresses. A contact_address row (with its
 * oa_contact_address companion) of the employee's contact points at an address_mst row; the address
 * lines are street_mst / location_mst / postcode_mst rows found — or added — by the typed text.
 *
 * Behaviour changes: the address parts are plain text fields (CI's autocompletes only suggested names; the
 * server always resolved the typed text); locations and postcodes are matched within their type and
 * brand (CI matched any location with that name, and added a junk "country" location on every save);
 * editing keeps the record's dates, police verification and the address's flat number / dwelling type
 * (CI reset the dates to 1970 and wiped the rest); flags of other addresses are reset only for live
 * rows; the list finds the employee through the address's contact (CI's edit form looked them up by the
 * wrong user column); an employee without a login user has no contact and is refused.
 */
const ADDRESS_TYPE = 142; // CI CNTCTADDID
const COUNTRY = 61;
const LOCATION = { territory: 127, town: 66, city: 65, district: 64, county: 63 } as const;
const YES = (expr: string) => `CASE WHEN ${expr} ~ '^\\s*0*1(\\.0*)?\\s*$' THEN 'Yes' ELSE 'No' END`;
const loc = (expr: string) => `(SELECT l."LOC_NAME" FROM location_mst l WHERE l."LOC_ID" = ${asId(expr)} LIMIT 1)`;
const street = (expr: string, column: string) => `(SELECT s."${column}" FROM street_mst s WHERE s."STREET_ID" = ${asId(expr)} LIMIT 1)`;

/** The address parts of a contact_address row `t` (address_mst `am`). */
const PARTS = {
  HOUSE_NAME: 'am."HOUSE_NAME"',
  HOUSE_NO: 'am."HOUSE_NO"',
  STREET_NM: street('am."ADDRESS_LINE_1"', 'STREET_NAME'),
  AREAR: street('am."ADDRESS_LINE_2"', 'LOCALITY'),
  TOWN: street('am."ADDRESS_LINE_3"', 'AREA'),
  ADD_LINE_4: loc('am."ADDRESS_LINE_4"'),
  ADD_LINE_5: loc('am."ADDRESS_LINE_5"'),
  CITY_NM: loc('am."CITY"'),
  DISTRICT: loc('am."DISTRICT_ID"'),
  COUNTY: loc('am."COUNTY_ID"'),
  COUNTRY_NM: `(SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = am."COUNTRY" LIMIT 1)`,
  ADD_POSTCODE: `(SELECT pc."POSTCODE" FROM postcode_mst pc WHERE pc."POSTCODE_ID" = am."POSTCODE" LIMIT 1)`,
};
const FULL_ADDRESS = `CASE WHEN am."ADDRESS_ID" IS NULL THEN NULL ELSE concat_ws(', ', ${[
  'HOUSE_NAME', 'HOUSE_NO', 'STREET_NM', 'AREAR', 'TOWN', 'ADD_LINE_4', 'ADD_LINE_5', 'CITY_NM', 'DISTRICT', 'COUNTY', 'COUNTRY_NM', 'ADD_POSTCODE',
].map((k) => `NULLIF(btrim(${PARTS[k as keyof typeof PARTS]}), '')`).join(', ')}) END`;

/** The employee `alias`'s address (primary, else current, else latest) as one line — for printed forms. */
export const employeeAddressSql = (alias: string) => `(SELECT ${FULL_ADDRESS} FROM contact_address t
  LEFT JOIN address_mst am ON am."ADDRESS_ID" = t."ADD_ID"
  WHERE t."IS_DELETED" = 0 AND am."ADDRESS_ID" IS NOT NULL
    AND COALESCE((SELECT cm."REF_EMP_ID" FROM contact_mst cm WHERE cm."CNTCT_ID" = t."CNTCT_ID"), t."USER_ID") = ${alias}."REF_EMP_ID"
  ORDER BY (t."IS_PRIMARY_ADD" ~ '^\\s*0*1(\\.0*)?\\s*$') DESC, (t."IS_CURRENT_ADD" ~ '^\\s*0*1(\\.0*)?\\s*$') DESC, t."CNTCT_ADD_ID" DESC
  LIMIT 1)`;

/** Text value or null. */
const text = (v: string | boolean) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** location_mst of a type by name — the brand's own first, then a shared one — added when missing. */
async function locationId(tx: Tx, ctx: HubContext, name: string | null, type: number): Promise<number | null> {
  if (!name) return null;
  const { employee, subject } = ctx;
  const [found] = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "LOC_ID" AS id FROM location_mst
    WHERE lower(btrim("LOC_NAME")) = lower(${name}) AND "LOC_TYPE_ID" = ${type}
      AND ("OA_BRAND_ID" IS NULL OR "OA_BRAND_ID" = ${employee.brand}) AND COALESCE("IS_DELETED", false) = false
    ORDER BY "OA_BRAND_ID" NULLS LAST, "LOC_ID" LIMIT 1`;
  if (found) return Number(found.id);
  return insertRow(tx, 'location_mst', 'LOC_ID', {
    LOC_NAME: name, LOC_TYPE_ID: type, OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId, CREATEDBY: subject.userId,
  }, subject.userId);
}

async function postcodeId(tx: Tx, ctx: HubContext, postcode: string | null): Promise<number | null> {
  if (!postcode) return null;
  const { employee, subject } = ctx;
  const [found] = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "POSTCODE_ID" AS id FROM postcode_mst
    WHERE upper(btrim("POSTCODE")) = upper(${postcode}) AND COALESCE("IS_DELETED", false) = false
    ORDER BY ("OA_BRAND_ID" = ${employee.brand}) DESC NULLS LAST, "POSTCODE_ID" LIMIT 1`;
  if (found) return Number(found.id);
  return insertRow(tx, 'postcode_mst', 'POSTCODE_ID', {
    POSTCODE: postcode.toUpperCase(), OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId, CREATEDBY: subject.userId,
  }, subject.userId);
}

async function save(tx: Tx, v: Record<string, string | boolean>, ctx: HubContext): Promise<number> {
  const { employee, subject } = ctx;
  const contactId = await contactOf(tx, {
    userId: employee.userId!, empId: employee.id, oaId: employee.oaId, oaBrandId: employee.brand, actorId: subject.userId,
  });
  const [territory, town, city, county, postcode] = [
    await locationId(tx, ctx, text(v.AddressLine4), LOCATION.territory),
    await locationId(tx, ctx, text(v.AddressLine5), LOCATION.town),
    await locationId(tx, ctx, text(v.City), LOCATION.city),
    await locationId(tx, ctx, text(v.CountryStateId), LOCATION.county),
    await postcodeId(tx, ctx, text(v.Postcode)),
  ];
  const country = Number(v.Country);
  // The previous address keeps the parts the form does not show (CI lost them on every edit).
  const [previous] = ctx.row
    ? await tx.$queryRaw<Array<{ flat: string | null; dwelling: number | null; census: number | null; district: number | null }>>`
        SELECT "FLAT_NO" AS flat, "DWELLING_TYPE_ID" AS dwelling, "CENSUS_BLOCK_ID" AS census, "DISTRICT_ID" AS district
        FROM address_mst WHERE "ADDRESS_ID" = ${Number(ctx.row.ADD_ID) || -1}`
    : [];

  const [line1, line2, line3] = [text(v.street)!, text(v.AddressLine2), text(v.AddressLine3)];
  const [existingStreet] = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "STREET_ID" AS id FROM street_mst
    WHERE lower(btrim("STREET_NAME")) = lower(${line1})
      AND lower(COALESCE(NULLIF(btrim("LOCALITY"), ''), '')) = lower(${line2 ?? ''})
      AND lower(COALESCE(NULLIF(btrim("AREA"), ''), '')) = lower(${line3 ?? ''})
      AND COALESCE("IS_DELETED", false) = false
    ORDER BY "STREET_ID" LIMIT 1`;
  const streetId = existingStreet ? Number(existingStreet.id) : await insertRow(tx, 'street_mst', 'STREET_ID', {
    STREET_NAME: line1, LOCALITY: line2, AREA: line3, TOWN_ID: town, CITY_ID: city, TERRITORY_ID: territory,
    DISTRICT_ID: previous?.district ?? null, POSTCODE_ID: postcode, COUNTRY_ID: country,
    OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId, CREATEDBY: subject.userId,
  }, subject.userId);

  // A new address_mst row on every save, as CI did (an address row may be shared).
  const addressId = await insertRow(tx, 'address_mst', 'ADDRESS_ID', {
    HOUSE_NO: text(v.HouseNo), HOUSE_NAME: text(v.HouseName), FLAT_NO: previous?.flat ?? null, DWELLING_TYPE_ID: previous?.dwelling ?? null,
    ADDRESS_LINE_1: String(streetId), ADDRESS_LINE_2: String(streetId), ADDRESS_LINE_3: String(streetId), STREET_ID: streetId,
    ADDRESS_LINE_4: territory ? String(territory) : null, ADDRESS_LINE_5: town ? String(town) : null, CITY: city ? String(city) : null,
    POSTCODE: postcode, COUNTRY: country, COUNTY_ID: county, DISTRICT_ID: previous?.district ?? null, CENSUS_BLOCK_ID: previous?.census ?? null,
    OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId, CREATEDBY: subject.userId,
  }, subject.userId);

  const type = Number(v.cntctAddTypeId);
  const recordId = ctx.id ?? -1;
  for (const [flag, column] of [[v.iscurrent, 'IS_CURRENT_ADD'], [v.isprimary, 'IS_PRIMARY_ADD']] as const) {
    if (!flag) continue;
    await tx.$executeRawUnsafe(
      `UPDATE contact_address SET "${column}" = '0', "UPDATED_BY" = $4::integer, "UPDATED_ON" = now()
       WHERE "CNTCT_ID" = $1::integer AND "CNTCT_ADD_TYPE_ID" = $2::integer AND "IS_DELETED" = 0 AND "CNTCT_ADD_ID" <> $3::integer`,
      contactId, type, recordId, subject.userId);
  }
  if (v.isprimary) {
    await tx.$executeRaw`
      UPDATE oa_contact_address SET "IS_PRIMARY" = false, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "CNTCT_ADD_ID" IN (SELECT "CNTCT_ADD_ID" FROM contact_address
                               WHERE "CNTCT_ID" = ${contactId} AND "CNTCT_ADD_TYPE_ID" = ${type} AND "IS_DELETED" = 0 AND "CNTCT_ADD_ID" <> ${recordId})`;
  }

  const record = {
    CNTCT_ID: contactId, CNTCT_ADD_TYPE_ID: type, ADD_ID: addressId, OA_ID_ORIGINATED: employee.oaId, OA_BRAND_ID: employee.brand,
    USER_ID: employee.userId, IS_CURRENT_ADD: v.iscurrent ? '1' : '0', IS_PRIMARY_ADD: v.isprimary ? '1' : '0',
  };
  const companion = { IS_PRIMARY: !!v.isprimary, OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId };
  if (!ctx.id) {
    const id = await insertRow(tx, 'contact_address', 'CNTCT_ADD_ID', {
      ...record, CNTCT_ADD_START_DATE: null, CNTCT_ADD_END_DATE: null, IS_POLICE_VERIFIED: 0, POLICE_COMMENTS: '',
    }, subject.userId);
    await insertRow(tx, 'oa_contact_address', 'OA_CNTCT_ADD_ID', { ...companion, CNTCT_ADD_ID: id }, subject.userId);
    return id;
  }
  await updateRow(tx, 'contact_address', 'CNTCT_ADD_ID', ctx.id, record, subject.userId);
  const updated = await tx.$executeRaw`
    UPDATE oa_contact_address SET "IS_PRIMARY" = ${!!v.isprimary}, "OA_ID" = ${employee.oaId}, "OA_BRAND_ID" = ${employee.brand},
      "USER_ID" = ${employee.userId}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
    WHERE "CNTCT_ADD_ID" = ${ctx.id}`;
  if (!updated) await insertRow(tx, 'oa_contact_address', 'OA_CNTCT_ADD_ID', { ...companion, CNTCT_ADD_ID: ctx.id }, subject.userId);
  return ctx.id;
}

export const empContactAddressConfig: HubConfig = {
  key: 'empContactAddress',
  defs: empContactAddressDefs,
  table: 'contact_address',
  pk: 'CNTCT_ADD_ID',
  empColumn: null,
  // The employee: the one whose login user owns the address's contact (else the row's USER_ID), preferring the row's brand.
  from: `contact_address t
    JOIN LATERAL (
      SELECT e.* FROM emp_mst e
      WHERE e."IS_DELETED" = 0
        AND e."REF_EMP_ID" = COALESCE((SELECT cm."REF_EMP_ID" FROM contact_mst cm WHERE cm."CNTCT_ID" = t."CNTCT_ID"), t."USER_ID")
      ORDER BY (e."OA_BRAND_ID" = t."OA_BRAND_ID") DESC NULLS LAST, e."EMP_ID" LIMIT 1) em ON true
    LEFT JOIN address_mst am ON am."ADDRESS_ID" = t."ADD_ID"`,
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT im."MSTR_NM" FROM independent_mst im WHERE im."MSTR_ID" = t."CNTCT_ADD_TYPE_ID" LIMIT 1) AS "CNTCT_ADD_TYPE_NM",
    ${Object.entries(PARTS).filter(([k]) => !['ADD_LINE_4', 'ADD_LINE_5', 'COUNTY'].includes(k)).map(([k, expr]) => `${expr} AS "${k}"`).join(', ')},
    ${FULL_ADDRESS} AS "FULL_ADDRESS", ${YES('t."IS_CURRENT_ADD"')} AS "Is_Current_Add", ${YES('t."IS_PRIMARY_ADD"')} AS "Is_Primary_Add",
    t."IS_POLICE_VERIFIED"`,
  search: ['CNTCT_ADD_TYPE_NM', 'FULL_ADDRESS'],
  sorts: ['CNTCT_ADD_TYPE_NM', 'STREET_NM', 'CITY_NM', 'COUNTRY_NM', 'ADD_POSTCODE', 'Is_Current_Add', 'Is_Primary_Add'],
  bind: { cntctAddTypeId: 'CNTCT_ADD_TYPE_ID', isprimary: 'IS_PRIMARY_ADD', iscurrent: 'IS_CURRENT_ADD' },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Address Details', updated: 'Successfully Updated Address Details', deleted: 'Successfully Deleted Address Details' },

  options: async (_subject, brand, row) => {
    const [types, countries] = await Promise.all([brandMasters({ id: ADDRESS_TYPE }, brand), mastersByType(COUNTRY)]);
    const [address] = row
      ? await prisma.$queryRaw<Array<{ country: number | null }>>`SELECT "COUNTRY" AS country FROM address_mst WHERE "ADDRESS_ID" = ${Number(row.ADD_ID) || -1}`
      : [];
    return {
      addressTypes: await keepCurrent(types, row?.CNTCT_ADD_TYPE_ID, masterLabel),
      countries: await keepCurrent(countries, address?.country, masterLabel),
    };
  },

  async read(row, values) {
    const [parts] = await prisma.$queryRawUnsafe<Array<Record<string, string | number | null>>>(
      `SELECT ${Object.entries(PARTS).map(([k, expr]) => `${expr} AS "${k}"`).join(', ')}, am."COUNTRY" AS country
       FROM address_mst am WHERE am."ADDRESS_ID" = $1::integer`,
      Number(row.ADD_ID) || -1);
    const set = { HouseName: 'HOUSE_NAME', HouseNo: 'HOUSE_NO', street: 'STREET_NM', AddressLine2: 'AREAR', AddressLine3: 'TOWN',
      AddressLine4: 'ADD_LINE_4', AddressLine5: 'ADD_LINE_5', City: 'CITY_NM', CountryStateId: 'COUNTY', Postcode: 'ADD_POSTCODE' };
    for (const [field, key] of Object.entries(set)) values[field] = str(parts?.[key]);
    values.Country = parts?.country ? String(parts.country) : '';
  },

  validate(v, check, ctx) {
    if (!ctx.employee.userId) {
      check.fail('EMP_ID', 'This employee has no login user, so an address cannot be linked to them.');
      return;
    }
    const city = String(v.City);
    if (city && city !== ctx.existing?.City && !check.has('City') && !/^[\p{L} .'-]+$/u.test(city)) {
      check.fail('City', 'The City field may only contain letters, spaces, apostrophes and hyphens.');
    }
  },

  insert: (tx, v, ctx) => save(tx, v, ctx),
  update: async (tx, v, ctx) => {
    await save(tx, v, ctx);
  },

  /** CI delete(): the address record, its companion and its phone numbers (the address itself stays). */
  async remove(tx, ctx) {
    const id = ctx.id!;
    for (const table of ['contact_add_phoneno', 'oa_contact_address', 'contact_address']) {
      await tx.$executeRawUnsafe(
        `UPDATE ${table} SET "IS_DELETED" = 1, "UPDATED_BY" = $2::integer, "UPDATED_ON" = now() WHERE "CNTCT_ADD_ID" = $1::integer`,
        id, ctx.subject.userId);
    }
  },
};
