import { readQuery, withApi } from '@/lib/http/withApi';
import { grossEarningsService as svc } from '@/lib/systmMngt/grossEarnings';

/** GET ?ctc= — CI gross_earnings_pay_distribution_calc/calculateGrossPay/{ctc}. */
export const GET = withApi(async ({ req, subject }) => svc.calculate(subject, readQuery(req).ctc ?? ''));
