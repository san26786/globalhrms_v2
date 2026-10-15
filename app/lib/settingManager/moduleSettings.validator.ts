import { z } from 'zod';
import { isMatch } from 'date-fns';
import type { AttributeRecord } from './moduleSettings.types';

/**
 * Input of a save (replaces CI's $this->input->post('settingGroupAttribute') array):
 * { answers: { [attributeId]: string | string[] } } — a checkbox field posts its ids as an array.
 */
export const saveBodySchema = z.object({
  answers: z
    .record(z.string().regex(/^\d+$/, 'Invalid attribute id.'), z.union([z.string().max(250), z.array(z.string().max(50)).max(200)]))
    .refine((a) => Object.keys(a).length <= 2000, 'Too many settings.'),
});

export type SaveBody = z.infer<typeof saveBodySchema>;

/** CI upsert: implode(',', $options) for checkboxes; text trimmed (CI rule "trim"). */
export function normaliseAnswer(value: string | string[]): string {
  return Array.isArray(value) ? value.map((v) => v.trim()).filter(Boolean).join(',') : value.trim();
}

export interface DataTypeIds {
  number: number | null;
  multipleChoice: number | null;
  date: number | null;
}

/**
 * CI setFormValidationRules (ONLY below super admin — preserved: a super admin's save is not
 * validated at all): every posted attribute is required unless its data type is Multiple Choice
 * (GSDVT); Number (GSDVTN) must be numeric. Messages are CI's form_validation texts.
 * Behaviour change: a Date (GSDVTD) value must be a real yyyy-MM-dd date (the format stored in
 * oa_brand_setting_attribute_mst); CI accepted whatever the datepicker posted.
 * Returns field errors keyed `answers.<attributeId>`; empty = valid.
 */
export function validateAnswers(
  answers: Map<number, string>,
  attributes: Map<number, AttributeRecord>,
  types: DataTypeIds,
  enforce: boolean,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!enforce) return errors;
  for (const [attributeId, value] of answers) {
    const attr = attributes.get(attributeId);
    if (!attr) continue;
    const label = attr.label || `Setting ${attributeId}`;
    const key = `answers.${attributeId}`;
    if (attr.dataTypeId !== types.multipleChoice && value === '') {
      errors[key] = [`The ${label} field is required.`];
      continue;
    }
    if (value !== '' && attr.dataTypeId === types.number && !/^[-+]?\d*\.?\d+$/.test(value)) {
      errors[key] = [`The ${label} field must contain only numbers.`];
      continue;
    }
    if (value !== '' && attr.dataTypeId === types.date && !isMatch(value, 'yyyy-MM-dd')) {
      errors[key] = [`The ${label} field must be a valid date.`];
    }
  }
  return errors;
}
