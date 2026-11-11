import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { markCurrentAnnexures } from '@/lib/payroll/annexure/current';

/** CI emp_sal_component_mst/markCurrentAnnexure — POST { ids }: the selected annexures become their employees' current ones (admins). */
export const POST = withApi(async ({ req, subject }) => {
  const result = await markCurrentAnnexures(subject, await readJson(req));
  return ok(result, { message: result.message });
});
