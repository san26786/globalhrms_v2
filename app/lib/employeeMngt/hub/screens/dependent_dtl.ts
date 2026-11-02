import { prisma } from '@/lib/prisma';
import { dependentDtlDefs } from '../defs/dependent_dtl';
import { insertRow, isDate, masterName, today, updateRow, type HubConfig, type HubContext, type Tx } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';
import { NAME, ageFrom, relativeOf, relativeOptions, saveRelative } from '../relatives';

/**
 * CI employeeMngt/dependent_dtl ("Dependents"): an employee's dependents (table dependent_dtl; the person
 * is a relative contact — lib/employeeMngt/hub/relatives). Picking an existing relative prefills the name,
 * birth date and the relation already given on Emergency Contacts; leaving it empty adds a new person.
 *
 * Behaviour changes: the list's "Dependent Full Name" shows the dependent (CI's view repeated the
 * employee's name); the edit form shows the record's own relative (CI could show another record's
 * relation and a 1970 birth date); names may contain spaces, apostrophes and hyphens (CI: letters only);
 * the age is worked out from the birth date when one is given (CI stored what was typed, 0 when blank);
 * changing the relation updates only this employee's live emergency contact for the same person (CI:
 * every employee's).
 */
const RELATION = 160; // CI REALTIONSHIPTYPE

const AGE_EXPR = `CASE WHEN t."DATE_OF_BIRTH" IS NOT NULL THEN date_part('year', age(current_date, t."DATE_OF_BIRTH"))::int ELSE NULLIF(t."AGE", 0) END`;

async function save(tx: Tx, v: Record<string, string | boolean>, ctx: HubContext): Promise<number> {
  const { employee, subject } = ctx;
  const dob = String(v.dateOfBirth) || null;
  const { orgContactId } = await saveRelative(tx, ctx, {
    orgContactId: v.oaDepCntctsId ? Number(v.oaDepCntctsId) : null,
    firstName: String(v.firstName), lastName: String(v.lastName), dob, emergency: false,
  });
  const data = {
    EMP_ID: employee.id, EMP_NBR: employee.code, OA_DEP_CNTCTS_ID: orgContactId, RELATION_TYPE_ID: Number(v.relationTypeId),
    DATE_OF_BIRTH: dob, AGE: dob ? ageFrom(dob) : (v.age ? Number(v.age) : null),
    OA_ID: employee.oaId, OA_BRAND_ID: employee.brand, USER_ID: employee.userId,
  };
  if (!ctx.id) return insertRow(tx, 'dependent_dtl', 'DEPENDENT_DTL_ID', data, subject.userId);
  await updateRow(tx, 'dependent_dtl', 'DEPENDENT_DTL_ID', ctx.id, data, subject.userId);
  // CI kept the relation of a person who is also an emergency contact in step.
  await tx.$executeRaw`
    UPDATE emergency_contact_dtl SET "EMERG_CONTACT_RELATION_TYPE_ID" = ${Number(v.relationTypeId)}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
    WHERE "EMERG_CONTACT_ID" = ${orgContactId} AND "EMP_ID" = ${employee.id} AND "IS_DELETED" = 0`;
  return ctx.id;
}

export const dependentDtlConfig: HubConfig = {
  key: 'dependent_dtl',
  defs: dependentDtlDefs,
  table: 'dependent_dtl',
  pk: 'DEPENDENT_DTL_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `(SELECT NULLIF(btrim(COALESCE(cm."CNTCT_FRST_NM", '') || ' ' || COALESCE(cm."CNTCT_LST_NM", '')), '')
      FROM oa_contacts oc JOIN contact_mst cm ON cm."CNTCT_ID" = oc."CNTCT_ID" WHERE oc."OA_CNTCTS_ID" = t."OA_DEP_CNTCTS_ID" LIMIT 1) AS "CNTCT_FULL_NM",
    ${masterName('t."RELATION_TYPE_ID"')} AS "REALTION_TYPE_NAME", to_char(t."DATE_OF_BIRTH", 'YYYY-MM-DD') AS "DATE_OF_BIRTH", ${AGE_EXPR} AS "AGE"`,
  search: ['CNTCT_FULL_NM', 'REALTION_TYPE_NAME'],
  sorts: ['CNTCT_FULL_NM', 'REALTION_TYPE_NAME', 'DATE_OF_BIRTH', 'AGE'],
  bind: { oaDepCntctsId: 'OA_DEP_CNTCTS_ID', relationTypeId: 'RELATION_TYPE_ID', dateOfBirth: 'DATE_OF_BIRTH', age: 'AGE' },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Dependent Detail', updated: 'Successfully Updated Dependent Detail', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => ({
    relations: await keepCurrent(await brandMasters({ id: RELATION }, brand), row?.RELATION_TYPE_ID, masterLabel),
  }),

  async employeeOptions(employee, row) {
    const { list, details } = await relativeOptions(employee, row?.OA_DEP_CNTCTS_ID);
    return { options: { relatives: list }, extras: { relatives: { ...details } } };
  },

  async read(row, values) {
    const person = row.OA_DEP_CNTCTS_ID ? await relativeOf(Number(row.OA_DEP_CNTCTS_ID)) : null;
    values.firstName = person?.first ?? '';
    values.lastName = person?.last ?? '';
    if (person?.dob) values.dateOfBirth = person.dob;
    if (values.age === '0') values.age = '';
  },

  async validate(v, check, ctx) {
    for (const [name, label] of [['firstName', 'First Name'], ['lastName', 'Last Name']] as const) {
      if (v[name] && !check.has(name) && !NAME.test(String(v[name]))) check.fail(name, `The ${label} field may only contain letters, spaces, apostrophes and hyphens.`);
    }
    const dob = String(v.dateOfBirth);
    if (dob && isDate(dob) && (dob < '1900-01-01' || dob > today())) check.fail('dateOfBirth', 'Enter a date of birth between 1900 and today.');
    const age = String(v.age);
    if (age && !dob && !/^\d{1,3}$/.test(age)) check.fail('age', 'The Age field must be a whole number.');

    const contact = Number(v.oaDepCntctsId);
    if (contact && !check.has('oaDepCntctsId')) {
      const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM dependent_dtl
        WHERE "EMP_ID" = ${ctx.employee.id} AND "OA_DEP_CNTCTS_ID" = ${contact} AND "IS_DELETED" = 0 AND "DEPENDENT_DTL_ID" <> ${ctx.id ?? -1}`;
      if (dup.n) check.fail('oaDepCntctsId', 'Record already exists');
    }
  },

  insert: (tx, v, ctx) => save(tx, v, ctx),
  update: async (tx, v, ctx) => {
    await save(tx, v, ctx);
  },
};
