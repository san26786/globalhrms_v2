import { ok } from '@/lib/http/respond';
import { withApi } from '@/lib/http/withApi';
import { annexureGenerator } from '@/lib/payroll/annexure/generate';

/** Annexure Processing's Generate dialog — GET: the brand's employees, defaults, gratuity switch, what the caller may do. */
export const GET = withApi(async ({ subject }) => ok(await annexureGenerator.options(subject)));
