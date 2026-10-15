import { withApi } from '@/lib/http/withApi';
import { periodService } from '@/lib/periodMngt';

/** GET — CI getCustomFields(): Period Type / Period Status filters + whether admin actions show. */
export const GET = withApi(async ({ subject }) => periodService.filters(subject));
