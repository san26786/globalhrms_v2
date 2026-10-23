import { z } from 'zod';

/** CI salaryComponentMember/salarycomponentmember form — every field but Is Enabled required. */
const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);
const requiredId = (label: string) =>
  z.preprocess(blankToNull, z.coerce.number({ error: `The ${label} field is required.` }).int().positive(`The ${label} field is required.`));
const flag = z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean());

export const salaryComponentMemberSchema = z
  .object({
    componentId: requiredId('Component'),
    typeId: requiredId('Member Component'),
    calcSequence: z.preprocess(
      blankToNull,
      z.coerce
        .number({ error: 'The Calculation Sequence field is required.' })
        .int('The Calculation Sequence field must contain only numbers.')
        .min(0, 'The Calculation Sequence field must contain only numbers.'),
    ),
    componentTypeId: requiredId('Component Type'),
    isEnabled: flag,
  })
  .refine((v) => v.componentId !== v.typeId, {
    path: ['typeId'],
    message: 'A component cannot be a member of itself.',
  });

export type SalaryComponentMemberInput = z.infer<typeof salaryComponentMemberSchema>;
