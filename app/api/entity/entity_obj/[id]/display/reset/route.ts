import { withApi } from '@/lib/http/withApi';
import { displayConfigService } from '@/lib/entity/display/displayConfig.service';

/** CI common_c::resetLabelAsDefault — brand admin: copy the system labels onto the brand's rows. */
export const POST = withApi<{ id: string }>(async ({ params, subject }) => displayConfigService.resetToDefault(subject, params.id));
