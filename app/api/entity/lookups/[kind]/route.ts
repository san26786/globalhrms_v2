import { z } from 'zod';
import { readQuery, withApi } from '@/lib/http/withApi';
import { NotFoundError } from '@/lib/http/errors';
import { entityLookups } from '@/lib/entity/lookups/entityLookups.service';
import { OBJECT_TYPES } from '@/validations/entity.schema';

/**
 * GET /api/entity/lookups/{kind} — entity dropdown options [{ value, label }] (admins only):
 *   objects?objTyp=VIEW            entity_obj (value OBJ_ID)
 *   attribute-objects              distinct OBJ_NM having attributes (value OBJ_NM)
 *   attributes?objNm= | ?objId=    attributes of an object (value OBJ_ATTRBT_ID)
 *   mapping-attributes?mappingId=&side=src|trg
 *   object-mappings                entity_obj_mppng (value OBJ_MPPNG_ID)
 */
const id = z.coerce.number().int().positive();

export const GET = withApi<{ kind: string }>(async ({ req, params, subject }) => {
  const q = readQuery(req);
  switch (params.kind) {
    case 'objects':
      return entityLookups.objects(subject, q.objTyp ? z.enum(OBJECT_TYPES).parse(q.objTyp) : undefined);
    case 'attribute-objects':
      return entityLookups.attributeObjects(subject);
    case 'attributes':
      return entityLookups.attributes(subject, {
        objNm: q.objNm ? z.string().trim().max(100).parse(q.objNm) : undefined,
        objId: q.objId ? id.parse(q.objId) : undefined,
      });
    case 'mapping-attributes':
      return entityLookups.mappingAttributes(subject, id.parse(q.mappingId), z.enum(['src', 'trg']).parse(q.side));
    case 'object-mappings':
      return entityLookups.objectMappings(subject);
    default:
      throw new NotFoundError('Unknown lookup.');
  }
});
