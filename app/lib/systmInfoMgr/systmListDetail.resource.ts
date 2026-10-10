import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { listDetailSchema, type ListDetailInput } from '@/validations/systmInfoMgr.schema';

/**
 * System List Details — CI controllers/systmInfoMgr/systm_lst_dtls.php (the "last number used"
 * counters per table). CI lists every row (no org/user filter) and always stamps org/brand/user
 * from the session.
 */
export interface ListDetailDto {
  id: number;
  tableName: string;
  lastNumber: number;
}

const definition: ResourceDefinition<ListDetailInput, ListDetailInput, ListDetailDto> = {
  label: 'System list detail',
  model: 'systm_lst_dtl',
  primaryKey: 'TBL_ID',
  searchFields: ['TBL_NM'],
  sortFields: ['TBL_ID', 'TBL_NM', 'LST_NMBR'],
  defaultSort: { field: 'TBL_ID', dir: 'desc' },
  tenancy: { mode: 'none', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', userColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedOn: 'UPDATED_ON' },
  policy: menuPolicy('systmInfoMgr/systm_lst_dtls'),
  createSchema: listDetailSchema,
  updateSchema: listDetailSchema,
  toCreateData: (i) => ({ TBL_NM: i.tableName, LST_NMBR: i.lastNumber }),
  toUpdateData: (i) => ({ TBL_NM: i.tableName, LST_NMBR: i.lastNumber }),
  toDto: (r) => ({ id: r.TBL_ID as number, tableName: r.TBL_NM as string, lastNumber: r.LST_NMBR as number }),
};

export const systmListDetailService = new ResourceService(definition);
