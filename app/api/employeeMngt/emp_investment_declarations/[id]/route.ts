import { withApi } from '@/lib/http/withApi';
import { declarationPage } from '@/lib/payroll/declarations/declarationService';

/** CI employeeMngt/emp_investment_declarations/index/{id} — the declaration page's data (summary, sections, options). */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => declarationPage(subject, params.id));
