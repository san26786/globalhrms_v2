import { empWorkExpDefs } from '../defs/empWorkExp';
import { masterName, today, type HubConfig } from '../hubEngine';
import { brandMasters, keepCurrent, masterLabel } from '../hubOptions';

/**
 * CI employeeMngt/empWorkExp ("Work Experience"): an employee's previous jobs (table emp_work_experience).
 *
 * Behaviour changes: the job-title dropdown is labelled "Job Role" (CI showed two "Job Title" fields); the
 * employer accepts ordinary names ("Tata & Sons", "Infosys Ltd."; CI allowed letters only); dates are
 * checked on the server — start before end, neither in the future (CI only had datepicker limits, and its
 * date conversion lost dates for some brand date formats); a blank sequence number is stored as NULL
 * (CI: 0); options are the employee's brand's job roles.
 */
const JOB_ROLE = 158; // CI JOBTITLEID

export const empWorkExpConfig: HubConfig = {
  key: 'empWorkExp',
  defs: empWorkExpDefs,
  table: 'emp_work_experience',
  pk: 'EMP_WORK_EXPERIENCE_ID',
  empColumn: 'EMP_ID',
  alive: 't."IS_DELETED" = 0',
  listColumns: `t."EEXP_EMPLOYER", ${masterName('t."JOB_TITLE_ID"')} AS "JOB_TITLE", t."JOBTITLE",
    to_char(t."EEXP_FROM_DATE", 'YYYY-MM-DD') AS "EEXP_FROM_DATE", to_char(t."EEXP_TO_DATE", 'YYYY-MM-DD') AS "EEXP_TO_DATE",
    CASE WHEN t."EEXP_INTERNAL" ~ '^\\s*0*1(\\.0*)?\\s*$' THEN 'Yes' ELSE 'No' END AS "EEXP_INTERNAL", NULLIF(t."EEXP_SEQNO", 0) AS "EEXP_SEQNO"`,
  search: ['EEXP_EMPLOYER', 'JOB_TITLE', 'JOBTITLE'],
  sorts: ['EEXP_EMPLOYER', 'JOB_TITLE', 'JOBTITLE', 'EEXP_FROM_DATE', 'EEXP_TO_DATE', 'EEXP_SEQNO'],
  bind: {
    eexpSeqno: 'EEXP_SEQNO', eexpEmployer: 'EEXP_EMPLOYER', jobTitleId: 'JOB_TITLE_ID', jobTitle: 'JOBTITLE',
    eexpFromDate: 'EEXP_FROM_DATE', eexpToDate: 'EEXP_TO_DATE', eexpComments: 'EEXP_COMMENTS', eexpInternal: 'EEXP_INTERNAL',
  },
  deleteMode: 'soft',
  messages: {
    created: 'Successfully Added Employee Work Experience Detail',
    updated: 'Successfully Updated Employee Work Experience Detail',
    deleted: 'Successfully Deleted',
  },

  options: async (_subject, brand, row) => ({
    jobRoles: await keepCurrent(await brandMasters({ id: JOB_ROLE }, brand), row?.JOB_TITLE_ID, masterLabel),
  }),

  read(_row, values) {
    if (values.eexpSeqno === '0') values.eexpSeqno = '';
  },

  validate(v, check, ctx) {
    const changed = (name: string) => v[name] !== ctx.existing?.[name];
    const seq = String(v.eexpSeqno);
    if (seq && changed('eexpSeqno') && !check.has('eexpSeqno') && !/^\d{1,9}$/.test(seq)) {
      check.fail('eexpSeqno', 'The Sequence Number field must contain only positive numbers.');
    }
    const from = String(v.eexpFromDate);
    const to = String(v.eexpToDate);
    if (!(changed('eexpFromDate') || changed('eexpToDate')) || check.has('eexpFromDate') || check.has('eexpToDate')) return;
    const now = today();
    if (from && from > now) check.fail('eexpFromDate', 'Start Date cannot be in the future.');
    if (to && to > now) check.fail('eexpToDate', 'End Date cannot be in the future.');
    if (from && to && !check.has('eexpFromDate') && !check.has('eexpToDate')) {
      if (from === to) check.fail('eexpFromDate', 'Start and End date can not be same');
      else if (to < from) check.fail('eexpToDate', 'End Date must be after Start Date.');
    }
  },

  extraColumns: (_v, ctx) => ({ EMP_NBR: ctx.employee.code }),
};
