import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { timesheetService, type ActionResult } from '@/lib/timesheet/timesheet.service';

/**
 * POST /api/timesheet/timesheet/{id}/{action} — the edit form's buttons (CI $data['buttons']):
 *   submit → submitForApprovalTs   approve / reject { approverComment } → ApproveTs / RejectTs
 *   approve-copy → ApproveForCopy   copy → copyTimesheet   copy-daily → copyDailyTimesheet
 * Response data: { message, id?, redirect? }.
 */
const ACTIONS: Record<string, (s: RequestSubject, id: string, body: unknown) => Promise<ActionResult>> = {
  submit: (s, id) => timesheetService.submit(s, id),
  approve: (s, id, body) => timesheetService.decide(s, id, 'approve', body),
  reject: (s, id, body) => timesheetService.decide(s, id, 'reject', body),
  'approve-copy': (s, id) => timesheetService.approveForCopy(s, id),
  copy: async (s, id) => {
    const result = await timesheetService.copy(s, id);
    return { ...result, redirect: `/timesheet/timesheet/edit/${result.id}` };
  },
  'copy-daily': (s, id) => timesheetService.copyDaily(s, id),
};

export const POST = withApi<{ id: string; action: string }>(async ({ req, params, subject }) => {
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, params.action) ? ACTIONS[params.action] : null;
  if (!run) throw new NotFoundError('Unknown action.');
  const result = await run(subject, params.id, await readJson(req));
  return ok(result, { message: result.message });
});
