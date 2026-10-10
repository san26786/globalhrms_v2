import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { ACTIVE, findActiveObject, objectNames } from '../entityShared';

/**
 * Dropdown data for the entity screens (CI getAllEntityObj, getAllEntityObjAttrbtUniqueObjNm,
 * getObjAttrbtNmByObjName, obj_mppng_m::getAllObjMppng). Administrators only — every entity screen
 * that uses them is an admin screen.
 */
export interface EntityOption {
  value: number | string;
  label: string;
}

function requireAdmin(subject: RequestSubject) {
  if (subject.adminLevel < 1) throw new ForbiddenError();
}

export const entityLookups = {
  /** entity_obj → value OBJ_ID. */
  async objects(subject: RequestSubject, objTyp?: string): Promise<EntityOption[]> {
    requireAdmin(subject);
    const rows = await prisma.entity_obj.findMany({
      where: { IS_DELETED: ACTIVE, ...(objTyp ? { OBJ_TYP: objTyp } : {}) },
      select: { OBJ_ID: true, OBJ_NM: true },
      orderBy: [{ OBJ_NM: 'asc' }, { OBJ_ID: 'asc' }],
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => (seen.has(r.OBJ_NM) ? false : (seen.add(r.OBJ_NM), true)))
      .map((r) => ({ value: r.OBJ_ID, label: r.OBJ_NM }));
  },

  /** Distinct OBJ_NM that have attributes → value OBJ_NM (CI getAllEntityObjAttrbtUniqueObjNm). */
  async attributeObjects(subject: RequestSubject): Promise<EntityOption[]> {
    requireAdmin(subject);
    const rows = await prisma.entity_obj_attrbt.findMany({
      where: { IS_DELETED: ACTIVE },
      distinct: ['OBJ_NM'],
      select: { OBJ_NM: true },
      orderBy: { OBJ_NM: 'asc' },
    });
    return rows.map((r) => ({ value: r.OBJ_NM, label: r.OBJ_NM }));
  },

  /** Attributes of one object (by name or id) → value OBJ_ATTRBT_ID. */
  async attributes(subject: RequestSubject, by: { objNm?: string; objId?: number }): Promise<EntityOption[]> {
    requireAdmin(subject);
    let objNm = by.objNm;
    if (!objNm && by.objId) {
      const object = await findActiveObject(by.objId);
      if (!object) throw new NotFoundError('Entity object not found.');
      objNm = object.OBJ_NM;
    }
    if (!objNm) return [];
    const rows = await prisma.entity_obj_attrbt.findMany({
      where: { OBJ_NM: objNm, IS_DELETED: ACTIVE },
      select: { OBJ_ATTRBT_ID: true, OBJ_ATTRBT_NM: true },
      orderBy: [{ OBJ_ATTRBT_SEQ: 'asc' }, { OBJ_ATTRBT_ID: 'asc' }],
    });
    return rows.map((r) => ({ value: r.OBJ_ATTRBT_ID, label: r.OBJ_ATTRBT_NM }));
  },

  /** Attributes of the source or target object of an object mapping (CI ajaxDepnDropObjAttrbtNm). */
  async mappingAttributes(subject: RequestSubject, mappingId: number, side: 'src' | 'trg'): Promise<EntityOption[]> {
    requireAdmin(subject);
    const mapping = await prisma.entity_obj_mppng.findFirst({
      where: { OBJ_MPPNG_ID: mappingId, IS_DELETED: ACTIVE },
      select: { SRC_OBJ_ID: true, TRGT_OBJ_ID: true },
    });
    if (!mapping) throw new NotFoundError('Object mapping not found.');
    return entityLookups.attributes(subject, { objId: side === 'src' ? mapping.SRC_OBJ_ID : mapping.TRGT_OBJ_ID });
  },

  /** entity_obj_mppng → "source → target" (CI getAllObjMppng). */
  async objectMappings(subject: RequestSubject): Promise<EntityOption[]> {
    requireAdmin(subject);
    const rows = await prisma.entity_obj_mppng.findMany({
      where: { IS_DELETED: ACTIVE },
      select: { OBJ_MPPNG_ID: true, SRC_OBJ_ID: true, TRGT_OBJ_ID: true },
      orderBy: { OBJ_MPPNG_ID: 'asc' },
    });
    const names = await objectNames(rows.flatMap((r) => [r.SRC_OBJ_ID, r.TRGT_OBJ_ID]));
    return rows.map((r) => ({
      value: r.OBJ_MPPNG_ID,
      label: `#${r.OBJ_MPPNG_ID}: ${names.get(r.SRC_OBJ_ID) ?? `object ${r.SRC_OBJ_ID}`} → ${names.get(r.TRGT_OBJ_ID) ?? `object ${r.TRGT_OBJ_ID}`}`,
    }));
  },
};
