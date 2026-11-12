import { initRoute } from '@/lib/form-init/initRoute';
import { timesheetEmployeeForm } from '@/lib/timesheet/timesheetEmployee';

/** GET ?id= — CI timesheet/timesheet_emp::initForm($id). */
export const dynamic = 'force-dynamic';

export const { GET } = initRoute(timesheetEmployeeForm);
