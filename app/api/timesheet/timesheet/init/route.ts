import { initRoute } from '@/lib/form-init/initRoute';
import { timesheetForm } from '@/lib/timesheet/timesheet.form';

/** GET ?id= — CI timesheet/timesheet::initForm($id): fields, values, buttons, items table, save action. */
export const dynamic = 'force-dynamic';

export const { GET } = initRoute(timesheetForm);
