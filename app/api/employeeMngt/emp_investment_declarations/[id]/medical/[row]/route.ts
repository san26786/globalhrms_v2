import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { removeMedicalRow } from '@/lib/payroll/declarations/declarationService';

/** CI emp_investment_declarations/medicial_delete — DELETE removes one Medical Expenses row and rolls the header up. */
export const DELETE = withApi<{ id: string; row: string }>(async ({ params, subject }) => {
  const result = await removeMedicalRow(subject, params.id, params.row);
  return ok(result, { message: result.message });
});
