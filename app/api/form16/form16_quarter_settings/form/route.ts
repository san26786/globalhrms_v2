import { readQuery, withApi } from '@/lib/http/withApi';
import { form16QuarterSettingsService as svc } from '@/lib/payroll/form16/quarterSettings';

/** CI form16/form16_quarter_settings initForm — GET [?id=] → the brand's financial years and the quarters. */
export const GET = withApi(async ({ req, subject }) => svc.form(subject, readQuery(req)));
