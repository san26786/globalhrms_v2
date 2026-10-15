import { NotFoundError } from '@/lib/http/errors';
import { readQuery, withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';
import { parsePeriodId } from '@/lib/periodMngt/period.validator';

/** GET ?id= — CI initForm($id): title, period types, statuses (edit), the record, Verify button. */
export const GET = withApi(async ({ req, subject }) => {
  const raw = readQuery(req).id;
  const id = raw ? parsePeriodId(raw) : null;
  if (raw && !id) throw new NotFoundError('Period not found.');
  return periodService.formInit(subject, id);
});
