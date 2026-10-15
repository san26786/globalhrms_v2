import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { payslipSettingsService as svc } from '@/lib/systmMngt/payslipSettings';

/**
 * CI payslip/payslip_settings ("Salary Slip Setting") — thin HTTP adapter (rules in lib/systmMngt/payslipSettings).
 *   GET → the brand's setting (add or edit form) · PUT { prefix, reg_address, … } → CI insert() / update()
 */
export const GET = withApi(async ({ subject }) => svc.load(subject));

export const PUT = withApi(async ({ req, subject }) => {
  const result = await svc.save(subject, await readJson(req));
  return ok(result, { message: result.message });
});
