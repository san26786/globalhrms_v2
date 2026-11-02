import { immigrationDtlDefs } from '../defs/immigration_dtl';
import { masterName, type HubConfig } from '../hubEngine';
import { keepCurrent, masterLabel, mastersByType } from '../hubOptions';

/**
 * CI employeeMngt/immigration_dtl ("Regulatory Requirement"): an employee's visas, passports and permits
 * (table immigration_dtl) with one attached document.
 *
 * Behaviour changes: the attachment is uploaded and downloaded through authenticated, scope-checked
 * routes, stored in IMMIGRATION_ATTACHMENT_DIR (CI's form never posted the file, so uploads silently did
 * nothing, and old files were public under uploads/immigration_attachments/ — point the variable at that
 * folder so they resolve); the expiry date must be after the issue date (CI only rejected equal dates);
 * empty countries are stored as NULL (CI: 0); the list shows country names, not the raw "Issued For" id.
 */
const IMMIGRATION_TYPE = 182; // CI hard-coded the type id
const COUNTRY = 61; // CI constant COUNTRY
const TEXT = /^[-a-z_ 0-9]+$/i; // CI alpha_dash_space

export const immigrationDtlConfig: HubConfig = {
  key: 'immigration_dtl',
  defs: immigrationDtlDefs,
  table: 'immigration_dtl',
  pk: 'IMMIGRATION_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = false',
  listColumns: `${masterName('t."IMMIGRATION_TYP_ID"')} AS "IMMIGRATION_TYPE", t."IMMIGRATION_NO",
    to_char(t."DATE_OF_ISSUE", 'YYYY-MM-DD') AS "DATE_OF_ISSUE", ${masterName('t."ISSUED_FOR"')} AS "ISSUED_FOR_COUNTRY",
    t."DOCUMENT_TITLE", to_char(t."DATE_OF_EXPIRY", 'YYYY-MM-DD') AS "DATE_OF_EXPIRY",
    ${masterName('t."PROCESSING_COUNTRY_ID"')} AS "PROCESSINGCOUNTRY_NM", t."ISSUING_AUTHORITY", t."ATTACHMENT_NAME"`,
  search: ['IMMIGRATION_TYPE', 'IMMIGRATION_NO', 'DOCUMENT_TITLE', 'ISSUING_AUTHORITY', 'ISSUED_FOR_COUNTRY', 'PROCESSINGCOUNTRY_NM'],
  sorts: ['IMMIGRATION_TYPE', 'DATE_OF_ISSUE', 'DATE_OF_EXPIRY'],
  bind: {
    immgrationTypId: 'IMMIGRATION_TYP_ID', immigrationNo: 'IMMIGRATION_NO', documentTitle: 'DOCUMENT_TITLE',
    issuingAuthority: 'ISSUING_AUTHORITY', immgrationDateOfIssue: 'DATE_OF_ISSUE', immgrationDateOfExpiry: 'DATE_OF_EXPIRY',
    immgrationProcessingCountryId: 'PROCESSING_COUNTRY_ID', issusefor: 'ISSUED_FOR',
  },
  deleteMode: 'soft',
  messages: {
    created: 'Successfully Added Regulatory Requirement Details',
    updated: 'Successfully Updated Regulatory Requirement Details',
    deleted: 'Successfully Deleted',
  },
  attachment: {
    column: 'ATTACHMENT_NAME',
    store: {
      envVar: 'IMMIGRATION_ATTACHMENT_DIR',
      // CI: docx|doc|xlsx|xls|pdf|txt; scanned passports are images.
      allowed: new Set(['docx', 'doc', 'xlsx', 'xls', 'pdf', 'txt', 'jpg', 'jpeg', 'png']),
      maxBytes: 20 * 1024 * 1024,
      maxNameLength: 50, // ATTACHMENT_NAME varchar(50)
    },
  },

  options: async (_subject, _brand, row) => {
    const [types, countries] = await Promise.all([mastersByType(IMMIGRATION_TYPE), mastersByType(COUNTRY)]);
    return {
      immigrationTypes: await keepCurrent(types, row?.IMMIGRATION_TYP_ID, masterLabel),
      countries: await keepCurrent(await keepCurrent(countries, row?.PROCESSING_COUNTRY_ID, masterLabel), row?.ISSUED_FOR, masterLabel),
    };
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    for (const name of ['documentTitle', 'issuingAuthority']) {
      if (v[name] && changed(name) && !TEXT.test(String(v[name]))) check.fail(name, 'Only Alphanumeric Characters Are Allowed');
    }
    const issue = String(v.immgrationDateOfIssue);
    const expiry = String(v.immgrationDateOfExpiry);
    const datesChanged = changed('immgrationDateOfIssue') || changed('immgrationDateOfExpiry');
    if (issue && expiry && datesChanged && !check.has('immgrationDateOfIssue') && !check.has('immgrationDateOfExpiry')) {
      if (expiry === issue) check.fail('immgrationDateOfExpiry', 'Immigration issued and Expiry date can not be same');
      else if (expiry < issue) check.fail('immgrationDateOfExpiry', 'Date Of Expiry must be after Date Of Issue.');
    }
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),
};
