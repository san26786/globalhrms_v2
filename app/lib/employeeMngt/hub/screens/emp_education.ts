import { empEducationDefs } from '../defs/emp_education';
import { masterName, type HubConfig } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/emp_education ("Education"): an employee's qualifications (table emp_education; the
 * qualification and course type are master ids stored as text).
 *
 * Behaviour changes: institute / major / score accept ordinary text (CI's letters-only rules rejected
 * "St. Xavier's College", "B.Sc (Hons)", grades like "A+"); the year of passing must be a real year; the
 * end date must be after the start date (CI only rejected equal dates); the list shows the education
 * qualification's name (CI showed the raw id); options are the employee's brand's masters; delete is a
 * soft delete (CI's row icon hard-deleted).
 */
const QUALIFICATION_LEVEL = 164; // CI EDUQUALID

export const empEducationConfig: HubConfig = {
  key: 'emp_education',
  defs: empEducationDefs,
  table: 'emp_education',
  pk: 'ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `${masterName('t."EDU_QUAL_ID"')} AS "EMP_GRADE", t."INSTITUTE",
    ${masterName('t."EDUCATION_QUALIFICATION"')} AS "EDUCATION_QUALIFICATION",
    ${masterName('t."EDUCATION_COURSE_TYPE"')} AS "EDUCATION_COURSE_TYPE_NM", t."MAJOR", t."YEAR"::text AS "YEAR", t."SCORE",
    to_char(t."START_DATE", 'YYYY-MM-DD') AS "START_DATE", to_char(t."END_DATE", 'YYYY-MM-DD') AS "END_DATE"`,
  search: ['EMP_GRADE', 'INSTITUTE', 'EDUCATION_QUALIFICATION', 'EDUCATION_COURSE_TYPE_NM', 'MAJOR', 'YEAR', 'SCORE'],
  sorts: ['EMP_GRADE', 'INSTITUTE', 'EDUCATION_QUALIFICATION', 'EDUCATION_COURSE_TYPE_NM', 'YEAR', 'START_DATE', 'END_DATE'],
  bind: {
    EDU_QUAL_ID: 'EDU_QUAL_ID', Education_Qualification: 'EDUCATION_QUALIFICATION', INSTITUTE: 'INSTITUTE',
    Education_Course_Type: 'EDUCATION_COURSE_TYPE', MAJOR: 'MAJOR', YEAR: 'YEAR', SCORE: 'SCORE', START_DATE: 'START_DATE', END_DATE: 'END_DATE',
  },
  deleteMode: 'soft',
  messages: { created: 'Successfully Added Education Details', updated: 'Successfully Updated Education Details', deleted: 'Successfully Deleted' },

  options: async (_subject, brand, row) => {
    const [levels, qualifications, courseTypes] = await Promise.all([
      brandMasters({ id: QUALIFICATION_LEVEL }, brand),
      brandMasters({ code: 'EDUQUA' }, brand),
      brandMasters({ code: 'ECTY' }, brand),
    ]);
    return {
      qualificationLevels: await keepCurrent(levels, row?.EDU_QUAL_ID, masterLabel),
      qualifications: await keepCurrent(qualifications, row?.EDUCATION_QUALIFICATION, masterLabel),
      courseTypes: await keepCurrent(courseTypes, row?.EDUCATION_COURSE_TYPE, masterLabel),
    };
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    const year = String(v.YEAR);
    if (year && changed('YEAR') && !check.has('YEAR')) {
      const n = Number(year);
      if (!/^\d{4}$/.test(year) || n < 1900 || n > new Date().getFullYear() + 1) check.fail('YEAR', 'Enter a valid Year Of Passing (e.g. 2015).');
    }
    const start = String(v.START_DATE);
    const end = String(v.END_DATE);
    if (start && end && (changed('START_DATE') || changed('END_DATE')) && !check.has('START_DATE') && !check.has('END_DATE')) {
      if (start === end) check.fail('START_DATE', 'Both Date Can Not Be Same');
      else if (end < start) check.fail('END_DATE', 'End Date must be after Start Date.');
    }
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),
};
