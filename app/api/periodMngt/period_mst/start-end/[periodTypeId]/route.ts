import { ValidationError } from '@/lib/http/errors';
import { withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';
import { parsePeriodId } from '@/lib/periodMngt/period.validator';

/** GET — CI getStartEndDate/{periodTypeId}: suggested start / end dates and description. */
export const GET = withApi<{ periodTypeId: string }>(async ({ params, subject }) => {
  const periodTypeId = parsePeriodId(params.periodTypeId);
  if (!periodTypeId) throw new ValidationError('Please Select Period ID', { periodTypeId: ['Please Select Period ID'] });
  return periodService.startEndDates(subject, periodTypeId);
});
