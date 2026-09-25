import { getMasterId, getMasterCode, typeIdOf } from '@/lib/masters/masterService';

/**
 * user_mst.USER_STATUS_ID values (independent_mst, the user-status type — CI user_status_vw).
 * Codes are resolved within the user-status type because MSTR_CD is not unique across types
 * ('USD' is also "US Dollar").
 */
export const USER_STATUS = {
  ACTIVE: 'USA',
  INACTIVE: 'USI',
  PENDING_ACTIVATION: 'USPA',
  DEACTIVATED: 'USD',
  LOCKED: 'USL',
  PASSWORD_EXPIRED: 'USPE',
} as const;
export type UserStatusCode = (typeof USER_STATUS)[keyof typeof USER_STATUS];

let statusTypeId: number | null | undefined;
async function userStatusTypeId(): Promise<number | undefined> {
  if (statusTypeId === undefined) statusTypeId = await typeIdOf(USER_STATUS.ACTIVE);
  return statusTypeId ?? undefined;
}

export async function userStatusId(code: UserStatusCode): Promise<number> {
  const id = await getMasterId(code, { typeId: await userStatusTypeId() });
  if (!id) throw new Error(`User status ${code} is not configured in independent_mst.`);
  return id;
}

export async function userStatusCode(id: number | null | undefined): Promise<string | null> {
  return getMasterCode(id);
}
