import { prisma } from '@/lib/prisma';
import { empLanguageDefs } from '../defs/emp_language';
import { masterName, type HubConfig } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/emp_language ("Languages Known"): the languages an employee knows, with competency and
 * fluency (table emp_language).
 *
 * Behaviour changes: the comments column is on the form (CI hid the field and wiped stored comments on
 * every save); the duplicate check (same language and competency) ignores deleted rows and works for
 * every level (CI blocked re-adding a deleted language and never matched for super admins); options are
 * the employee's brand's masters.
 */
const LANGUAGE = 165;
const FLUENCY = 166;
const COMPETENCY = 167;

export const empLanguageConfig: HubConfig = {
  key: 'emp_language',
  defs: empLanguageDefs,
  table: 'emp_language',
  pk: 'EMP_LANGUAGE_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `${masterName('t."LANGUAGE_ID"')} AS "LANGUAGE", ${masterName('t."LANGUAGE_FLUENCY_ID"')} AS "LANGUAGE_FLUENCY",
    ${masterName('t."LANGUAGE_COMPETENCY_ID"')} AS "LANGUAGE_COMPETENCY"`,
  search: ['LANGUAGE', 'LANGUAGE_FLUENCY', 'LANGUAGE_COMPETENCY'],
  sorts: ['LANGUAGE', 'LANGUAGE_FLUENCY', 'LANGUAGE_COMPETENCY'],
  bind: {
    LANGUAGE_ID: 'LANGUAGE_ID', LANGUAGE_COMPETENCY_ID: 'LANGUAGE_COMPETENCY_ID', LANGUAGE_FLUENCY_ID: 'LANGUAGE_FLUENCY_ID', COMMENTS: 'COMMENTS',
  },
  deleteMode: 'soft',
  messages: {
    created: 'Successfully Added Employee Language Details',
    updated: 'Successfully Updated Employee Language Known Details',
    deleted: 'Successfully Deleted',
  },

  options: async (_subject, brand, row) => {
    const [languages, competencies, fluencies] = await Promise.all([
      brandMasters({ id: LANGUAGE }, brand),
      brandMasters({ id: COMPETENCY }, brand),
      brandMasters({ id: FLUENCY }, brand),
    ]);
    return {
      languages: await keepCurrent(languages, row?.LANGUAGE_ID, masterLabel),
      competencies: await keepCurrent(competencies, row?.LANGUAGE_COMPETENCY_ID, masterLabel),
      fluencies: await keepCurrent(fluencies, row?.LANGUAGE_FLUENCY_ID, masterLabel),
    };
  },

  async validate(v, check, ctx) {
    if (!v.LANGUAGE_ID || !v.LANGUAGE_COMPETENCY_ID || check.has('LANGUAGE_ID') || check.has('LANGUAGE_COMPETENCY_ID')) return;
    const [dup] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM emp_language
      WHERE "EMP_ID" = ${ctx.employee.id} AND "LANGUAGE_ID" = ${Number(v.LANGUAGE_ID)}
        AND "LANGUAGE_COMPETENCY_ID" = ${Number(v.LANGUAGE_COMPETENCY_ID)} AND "IS_DELETED" = 0 AND "EMP_LANGUAGE_ID" <> ${ctx.id ?? -1}`;
    if (dup.n) check.fail('LANGUAGE_ID', 'Combination of Employee Language already exists');
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),
};
