import { z } from 'zod';
import { isMatch } from 'date-fns';

/**
 * CI period_mst::setFormValidationRules (the field rules; checkDateRange / checkPeriod need the
 * database and run in the service). Messages are CI's form_validation texts.
 *
 * Behaviour changes:
 *  - dates must be real yyyy-MM-dd dates (CI ran strtotime() on whatever was posted, so an invalid
 *    date was stored as 1970-01-01);
 *  - the description is limited to 40 characters (period_mst.FISCAL_PERIOD_DESC varchar(40): a
 *    longer one was a database error).
 */

const required = (label: string) => `The ${label} field is required.`;
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const date = (label: string) =>
  z
    .string({ error: required(label) })
    .trim()
    .min(1, required(label))
    .refine((v) => isMatch(v, 'yyyy-MM-dd'), `The ${label} field must contain a valid date.`);

export const periodSaveSchema = z.object({
  periodTypeId: z.preprocess(blankToUndefined, z.coerce.number({ error: required('Period Type') }).int().positive(required('Period Type'))),
  periodStartDate: date('Period Start Date'),
  periodEndDate: date('Period End Date'),
  fiscalPeriodDesc: z
    .string({ error: required('Fiscal Period Description') })
    .trim()
    .min(1, required('Fiscal Period Description'))
    .max(40, 'The Fiscal Period Description field cannot exceed 40 characters in length.'),
  /** Edit only (add: CI posts OPSA). */
  periodStatusId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
});

export type PeriodSaveBody = z.infer<typeof periodSaveSchema>;

/** CI $this->input->post('delCheckbox') — the selected rows of a list action. */
export const periodIdsSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .max(1000, 'At most 1000 periods can be selected.')
    .default([])
    .transform((ids) => [...new Set(ids)]),
});

export function parsePeriodId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
