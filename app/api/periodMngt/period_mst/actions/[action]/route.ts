import { NotFoundError } from '@/lib/http/errors';
import { ok } from '@/lib/http/respond';
import { readJson, withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';

/**
 * POST /api/periodMngt/period_mst/actions/{action}  { ids?: number[] }
 * CI list actions (the selected rows were CI's delCheckbox[]):
 *   verify → verifyPeriod   lock → lockPeriod   unlock → unlockPeriod   close → endProcedure
 *   generate → generatePeriod   sync → syncPeriod   (generate / sync take no ids)
 * Response: { message, messages: { success?, warning?, danger? }, affected } — CI's flash messages.
 */
const ACTIONS = {
  verify: (s, body) => periodService.verify(s, body),
  lock: (s, body) => periodService.lock(s, body),
  unlock: (s, body) => periodService.unlock(s, body),
  close: (s, body) => periodService.close(s, body),
  generate: (s) => periodService.generate(s),
  sync: (s) => periodService.sync(s),
} satisfies Record<string, (subject: Parameters<typeof periodService.generate>[0], body: unknown) => ReturnType<typeof periodService.generate>>;

export const POST = withApi<{ action: string }>(async ({ req, params, subject }) => {
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, params.action)) throw new NotFoundError('Unknown action.');
  const run = ACTIONS[params.action as keyof typeof ACTIONS];
  const result = await run(subject, await readJson(req));
  return ok(result, { message: result.message });
});
