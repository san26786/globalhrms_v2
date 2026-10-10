import { readJson, withApi } from '@/lib/http/withApi';
import { displayConfigService } from '@/lib/entity/display/displayConfig.service';

/**
 * Column configuration of an entity object (CI entity_obj_attrbt::updateFlashModal + common_c::getLabel).
 *   GET → attributes with global / system / brand display settings for the caller
 *   PUT → { rows: [{ attributeId, isVisible?, label?, listView?, formView? }] }
 */
export const GET = withApi<{ id: string }>(async ({ params, subject }) => displayConfigService.get(subject, params.id));

export const PUT = withApi<{ id: string }>(async ({ req, params, subject }) =>
  displayConfigService.save(subject, params.id, await readJson(req)),
);
