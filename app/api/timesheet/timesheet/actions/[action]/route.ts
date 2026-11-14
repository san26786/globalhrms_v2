import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { timesheetService, type ActionResult } from '@/lib/timesheet/timesheet.service';

/**
 * POST /api/timesheet/timesheet/actions/{action} — the list actions (administrators):
 *   status { status: 'approve' | 'reject', ids }  → change_ts_status/{APR|RJT}
 *   auto-generate { TS_EMP_ID, PERIOD_ID }       → autoGenerateTImesheet
 *   delayed-permission { TS_EMP_ID, START_DATE, END_DATE?, DELAYED_FLAG } → grantDelayedTimesheetPermission
 *   generate-period                               → generatePeriod
 */
const ACTIONS: Record<string, (s: RequestSubject, body: unknown) => Promise<ActionResult>> = {
  status: (s, body) => timesheetService.bulkStatus(s, body),
  'auto-generate': (s, body) => timesheetService.autoGenerate(s, body),
  'delayed-permission': (s, body) => timesheetService.grantDelayed(s, body),
  'generate-period': (s) => timesheetService.generatePeriods(s),
};

export const POST = withApi<{ action: string }>(async ({ req, params, subject }) => {
  const run = Object.prototype.hasOwnProperty.call(ACTIONS, params.action) ? ACTIONS[params.action] : null;
  if (!run) throw new NotFoundError('Unknown action.');
  const result = await run(subject, await readJson(req));
  return ok(result, { message: result.message });
});
