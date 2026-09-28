import { z } from 'zod';
import { readJson, withApi } from '@/lib/http/withApi';
import { NotFoundError } from '@/lib/http/errors';
import { displayConfigService } from '@/lib/entity/display/displayConfig.service';
import { findActiveObjectByName } from '@/lib/entity/entityShared';
import type { RequestSubject } from '@/lib/auth/getSubject';

/**
 * List-view "Form Settings" modal (CI footer_v #configform) addressed by object name, as CI list
 * pages do ($pvs_objNm, e.g. 'user_role_vw'):
 *   GET → the object's columns with global / system / brand settings for the caller (admins only)
 *   PUT → { rows: [...], saveForAll?: true } — CI entity_obj_attrbt::updateFlashModal; with
 *         saveForAll (the super admin's "Save For All Brands") the brand overrides are then removed
 *         so every brand follows the saved system configuration (CI applyToAllBrands).
 */
const bodySchema = z.object({ saveForAll: z.boolean().optional() }).passthrough();

async function objectId(objNm: string): Promise<string> {
  const obj = await findActiveObjectByName(decodeURIComponent(objNm));
  if (!obj) throw new NotFoundError('This list has no column configuration.');
  return String(obj.OBJ_ID);
}

async function save(subject: RequestSubject, objNm: string, body: unknown) {
  const id = await objectId(objNm);
  const { saveForAll } = bodySchema.parse(body ?? {});
  const config = await displayConfigService.save(subject, id, body);
  if (!saveForAll) return config;
  return (await displayConfigService.applyToAllBrands(subject, id)).config;
}

export const GET = withApi<{ objNm: string }>(async ({ params, subject }) =>
  displayConfigService.get(subject, await objectId(params.objNm)),
);

export const PUT = withApi<{ objNm: string }>(async ({ req, params, subject }) => save(subject, params.objNm, await readJson(req)));
