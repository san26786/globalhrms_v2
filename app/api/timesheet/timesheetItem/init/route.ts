import { initRoute } from '@/lib/form-init/initRoute';
import { parseItemParams, timesheetItemForm } from '@/lib/timesheet/timesheetItem.form';

/**
 * GET ?id= | ?tsId= | ?date=&byDate=1 — CI timesheetItem::initForm / new_timesheet_item::initForm.
 */
export const dynamic = 'force-dynamic';

export const { GET } = initRoute(timesheetItemForm, parseItemParams);
