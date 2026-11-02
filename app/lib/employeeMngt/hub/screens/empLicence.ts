import { empLicenceDefs } from '../defs/empLicence';
import { masterName, type HubConfig } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/empLicence ("Licences"): an employee's licences (table emp_licence; the type is kept in
 * the misspelt LIENCE_TYPE_ID column, LICENSE_TYPE_ID is unused).
 *
 * Behaviour changes: licence numbers may contain spaces, "-" and "/" ("DL-0420110149646"; CI allowed
 * letters and digits only, 5–18 characters — now 5–30); the expiry date must be after the issue date
 * (CI only rejected equal dates); no type is stored as NULL (CI: 0); the list leaves out the id columns
 * CI's settings showed; options are the employee's brand's masters.
 */
const LICENCE_TYPE = 185; // CI LICENCETYPE
const LICENCE_NAME = 1002; // hard-coded in CI

export const empLicenceConfig: HubConfig = {
  key: 'empLicence',
  defs: empLicenceDefs,
  table: 'emp_licence',
  pk: 'LICENSE_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `${masterName('t."LIENCE_TYPE_ID"')} AS "LICENSE_TYP_NM", ${masterName('t."LICENSE_NM_ID"')} AS "LICENSE__NAME", t."LICENSE_NO",
    to_char(t."LICENSE_ISSUED_DATE", 'YYYY-MM-DD') AS "LICENSE_ISSUED_DATE", to_char(t."LICENSE_EXPIRY_DATE", 'YYYY-MM-DD') AS "LICENSE_EXPIRY_DATE"`,
  search: ['LICENSE_TYP_NM', 'LICENSE__NAME', 'LICENSE_NO'],
  sorts: ['LICENSE_TYP_NM', 'LICENSE__NAME', 'LICENSE_ISSUED_DATE', 'LICENSE_EXPIRY_DATE'],
  bind: {
    licemceType: 'LIENCE_TYPE_ID', licemceTypenm: 'LICENSE_NM_ID', licenceNo: 'LICENSE_NO',
    licenceIssuedDate: 'LICENSE_ISSUED_DATE', licenceExpiryDate: 'LICENSE_EXPIRY_DATE',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Employee Licence Detail', updated: 'Successfully Updated Employee Licence Detail', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => {
    const [types, names] = await Promise.all([brandMasters({ id: LICENCE_TYPE }, brand), brandMasters({ id: LICENCE_NAME }, brand)]);
    return {
      licenceTypes: await keepCurrent(types, row?.LIENCE_TYPE_ID, masterLabel),
      licenceNames: await keepCurrent(names, row?.LICENSE_NM_ID, masterLabel),
    };
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    const number = String(v.licenceNo);
    if (number && changed('licenceNo') && !check.has('licenceNo') && !/^[A-Za-z0-9 /-]{5,30}$/.test(number)) {
      check.fail('licenceNo', 'The License Number field must be 5 to 30 letters, digits, spaces, "-" or "/".');
    }
    const issued = String(v.licenceIssuedDate);
    const expiry = String(v.licenceExpiryDate);
    if (issued && expiry && (changed('licenceIssuedDate') || changed('licenceExpiryDate'))
      && !check.has('licenceIssuedDate') && !check.has('licenceExpiryDate')) {
      if (issued === expiry) check.fail('licenceExpiryDate', 'Licence issued and Expiry date can not be same');
      else if (expiry < issued) check.fail('licenceExpiryDate', 'License Expiry Date must be after License Issued Date.');
    }
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),
};
