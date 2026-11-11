import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { annexureGenerator } from '@/lib/payroll/annexure/generate';

/**
 * CI emp_sal_component_mst::generateAnnexureDetails — POST { empIds: number[] | 'all', monthYear: 'MM/YYYY',
 * effectiveDate: 'YYYY-MM-DD', isCurrent, calculateGratuity } → per-employee results (admins).
 */
export const POST = withApi(async ({ req, subject }) => {
  const result = await annexureGenerator.generate(subject, await readJson(req));
  return ok(result, { message: result.message });
});
