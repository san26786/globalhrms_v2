import { prisma } from '@/lib/prisma';
import { BusinessRuleError, ConflictError, ValidationError } from '@/lib/http/errors';
import { ResourceService, type ResourceDefinition } from '@/lib/resource';
import {
  entityObjSchema,
  entityObjUpdateSchema,
  OBJECT_TYPES,
  type EntityObjInput,
  type EntityObjUpdateInput,
} from '@/validations/entity.schema';
import { ACTIVE, DELETED, entityDefinitionPolicy, existingDbObjects } from '../entityShared';

/**
 * Entity Object — CI controllers/entity/entity_obj.php (list of entity_obj_vw, add/edit/delete).
 *
 * Rules preserved: Object Type and Object Name required; name max 50; name unique (the edited
 * record excluded, as CI did by comparing with the stored name).
 * Fixes / differences (documented):
 *  - name pattern [A-Za-z0-9_] (CI alpha_numeric rejected '_'); uniqueness is case-insensitive and
 *    among non-deleted rows; Object Type restricted to 'BASE TABLE' | 'VIEW'.
 *  - delete is SOFT (IS_DELETED = 1; CI hard-deleted) and refused while the object still has
 *    active attributes (they are linked by OBJ_NM, so they would be orphaned);
 *  - renaming an object that has active attributes is refused for the same reason.
 *  - every row carries `existsInDb` (one information_schema query per page).
 * Writes are system-admin only; admins may read.
 */
export interface EntityObjDto {
  id: number;
  objTyp: string;
  objNm: string;
  existsInDb: boolean;
  dbObjectType: string | null;
}

const MAX_NEW_NAME = 50;

async function assertNameUnique(objNm: string, exceptId?: number) {
  const clash = await prisma.entity_obj.findFirst({
    where: {
      OBJ_NM: { equals: objNm, mode: 'insensitive' },
      IS_DELETED: ACTIVE,
      ...(exceptId ? { NOT: { OBJ_ID: exceptId } } : {}),
    },
    select: { OBJ_ID: true },
  });
  if (clash) {
    const message = 'An entity object with this name already exists.';
    throw new ConflictError(message, { objNm: [message] });
  }
}

function activeAttributeCount(objNm: string) {
  return prisma.entity_obj_attrbt.count({ where: { OBJ_NM: objNm, IS_DELETED: ACTIVE } });
}

const definition: ResourceDefinition<EntityObjInput, EntityObjUpdateInput, EntityObjDto> = {
  label: 'Entity object',
  model: 'entity_obj',
  primaryKey: 'OBJ_ID',
  searchFields: ['OBJ_NM'],
  sortFields: ['OBJ_ID', 'OBJ_NM', 'OBJ_TYP'],
  defaultSort: { field: 'OBJ_NM', dir: 'asc' },
  filters: {
    objTyp: {
      column: 'OBJ_TYP',
      parse: (raw) => {
        if (!(OBJECT_TYPES as readonly string[]).includes(raw)) {
          throw new ValidationError('Invalid filter.', { objTyp: ['Object type must be BASE TABLE or VIEW.'] });
        }
        return raw;
      },
    },
  },
  tenancy: { mode: 'none' },
  softDelete: { column: 'IS_DELETED', deleted: DELETED, active: ACTIVE },
  policy: entityDefinitionPolicy,
  createSchema: entityObjSchema,
  updateSchema: entityObjUpdateSchema,
  toCreateData: (i) => ({ OBJ_TYP: i.objTyp, OBJ_NM: i.objNm }),
  toUpdateData: (i) => ({ OBJ_TYP: i.objTyp, OBJ_NM: i.objNm }),
  hooks: {
    beforeCreate: (i) => assertNameUnique(i.objNm),
    async beforeUpdate(id, i, existing) {
      const current = existing.OBJ_NM as string;
      if (i.objNm === current) return;
      if (i.objNm.length > MAX_NEW_NAME) {
        throw new ValidationError('Validation failed.', { objNm: [`Must be at most ${MAX_NEW_NAME} characters.`] });
      }
      await assertNameUnique(i.objNm, id);
      const attributes = await activeAttributeCount(current);
      if (attributes > 0) {
        throw new BusinessRuleError(
          `"${current}" has ${attributes} active attribute(s) linked by name; delete or move them before renaming the object.`,
          'ENTITY_OBJ_HAS_ATTRIBUTES',
          { objNm: ['The object has attributes and cannot be renamed.'] },
        );
      }
    },
    async beforeDelete(_id, existing) {
      const name = existing.OBJ_NM as string;
      const attributes = await activeAttributeCount(name);
      if (attributes > 0) {
        throw new BusinessRuleError(
          `"${name}" cannot be deleted: it still has ${attributes} active attribute(s). Delete its attributes first.`,
          'ENTITY_OBJ_HAS_ATTRIBUTES',
        );
      }
    },
    async enrichRows(rows) {
      const existing = await existingDbObjects(rows.map((r) => r.OBJ_NM as string));
      return rows.map((r) => ({ ...r, _dbType: existing.get(r.OBJ_NM as string) ?? null }));
    },
  },
  toDto: (r) => ({
    id: r.OBJ_ID as number,
    objTyp: r.OBJ_TYP as string,
    objNm: r.OBJ_NM as string,
    existsInDb: typeof r._dbType === 'string',
    dbObjectType: typeof r._dbType === 'string' ? r._dbType : null,
  }),
};

export const entityObjService = new ResourceService(definition);
