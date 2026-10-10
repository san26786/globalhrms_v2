import { withApi } from '@/lib/http/withApi';
import { displayConfigService } from '@/lib/entity/display/displayConfig.service';

/** CI common_c::applyToAllBrands — system admin: soft-delete every brand override of the object. */
export const POST = withApi<{ id: string }>(async ({ params, subject }) => displayConfigService.applyToAllBrands(subject, params.id));
