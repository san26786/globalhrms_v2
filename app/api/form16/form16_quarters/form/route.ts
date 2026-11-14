import { readQuery, withApi } from '@/lib/http/withApi';
import { form16QuartersService as svc } from '@/lib/payroll/form16/quarters';

/** CI form16/form16_quarters initForm — GET ?form16= (add for a Form 16) or ?id= (edit) → dropdowns and the Form 16. */
export const GET = withApi(async ({ req, subject }) => svc.form(subject, readQuery(req)));
