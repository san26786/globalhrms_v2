import type { RequestSubject } from '@/lib/auth/getSubject';
import type { PeriodGenerationResult } from '@/lib/utilities/periodGenerator';

/** The caller as the period module sees it (the request subject). */
export type PeriodActor = Pick<RequestSubject, 'userId' | 'adminLevel' | 'oaId' | 'oaBrandId' | 'isSysAdmin'>;

export interface IdName {
  value: number;
  label: string;
}

/** One period_mst row (dates as yyyy-MM-dd). */
export interface PeriodRecord {
  periodId: number;
  periodTypeId: number | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  fiscalPeriodDesc: string | null;
  periodStatusId: number | null;
  periodEnded: boolean;
  isVerified: boolean;
  isLocked: boolean;
  oaId: number;
  oaBrandId: number;
  userId: number;
}

/** CI flash messages of one action (several may be set at once, as in generatePeriod). */
export interface PeriodMessages {
  success?: string;
  warning?: string;
  danger?: string;
}

export interface PeriodActionResult {
  message: string;
  messages: PeriodMessages;
  affected: number;
}

/** Validated create / update input. */
export interface PeriodInput {
  periodTypeId: number;
  periodStartDate: string;
  periodEndDate: string;
  fiscalPeriodDesc: string;
  periodStatusId: number | null;
}

export interface PeriodWrite extends PeriodInput {
  periodStatusId: number;
  oaId: number;
  oaBrandId: number;
  userId: number;
  actorId: number;
  now: Date;
}

/** Ports the module depends on (dependency inversion: the service never imports Prisma). */
export interface PeriodRepository {
  /** CI getEnabledPeriodType(): period types whose module is licensed and enabled for the brand. */
  enabledPeriodTypes(oaBrandId: number, brandAppId: number, isSysAdmin: boolean): Promise<IdName[]>;
  mastersOfType(typeId: number): Promise<IdName[]>;
  /** OA_ID of a brand (CI oa_brands_m::getOaId) — for callers whose session has no organisation. */
  brandOrgId(oaBrandId: number): Promise<number | null>;
  find(periodId: number, oaBrandId: number): Promise<PeriodRecord | null>;
  /** CI getPeriodByDateAndCode(code, date, brand): first matching period id (active status only unless `anyStatus`). */
  periodCovering(args: { periodTypeId: number; date: string; oaBrandId: number; activeStatusId: number | null }): Promise<number | null>;
  /** CI checkPeriod(): any period_mst row (all brands, deleted too) with this description. */
  descriptionExists(fiscalPeriodDesc: string, exceptPeriodId: number | null): Promise<boolean>;
  /** CI getLastPeriodByCode(code, brand, includeEnded = true, asc = false). */
  latestPeriod(args: { periodTypeId: number; oaBrandId: number; activeStatusId: number | null }): Promise<{ periodEndDate: string } | null>;
  /** CI syncPeriod(): latest PERIOD_END_DATE per type (any status, deleted rows included, as CI). */
  latestEndDates(periodTypeIds: number[], oaBrandId: number): Promise<Map<number, string>>;
  insert(row: PeriodWrite): Promise<number>;
  update(periodId: number, row: PeriodWrite): Promise<void>;
  /** CI delete(): references in timesheet / leave / outdoor / performance / achievement. */
  referenceCount(periodIds: number[]): Promise<number>;
  softDelete(periodIds: number[], oaBrandId: number): Promise<number>;
  setLocked(periodIds: number[], oaBrandId: number, locked: boolean): Promise<number>;
  countLocked(periodIds: number[], oaBrandId: number): Promise<number>;
  setVerified(periodIds: number[], oaBrandId: number): Promise<number>;
  countUnverified(periodIds: number[], oaBrandId: number): Promise<number>;
  /** CI endProcedure(): PERIOD_ENDED = 1, PERIOD_STATUS_ID = inactive. */
  endPeriods(periodIds: number[], oaBrandId: number, inactiveStatusId: number): Promise<Array<{ periodId: number; periodTypeId: number | null }>>;
  /** CI endProcedure() checks: pending rows of the module that uses the period. */
  pendingCount(check: PendingCheck, periodId: number): Promise<number>;
}

/** One CI endProcedure() "pending requests" check. */
export interface PendingCheck {
  /** Period type master code the check applies to. */
  typeCode: string;
  table: 'leave_requests_dtl' | 'timesheet' | 'achievment' | 'outdrentr';
  periodColumn: string;
  statusColumn: string;
  statusIds: number[];
  message: string;
}

export interface PeriodSettings {
  /** settingService value (null when unset). */
  value(code: string, oaBrandId: number): Promise<string | null>;
  /** Brand value, else the system default (brand 0) — what the generator reads. */
  valueOrDefault(code: string, oaBrandId: number): Promise<string | null>;
}

export interface PeriodMasters {
  id(code: string): Promise<number | null>;
  code(id: number): Promise<string | null>;
  name(id: number): Promise<string | null>;
}

export interface PeriodGeneratorPort {
  /** utilities/periodGenerator (CI generatePeriods), optionally limited to some period type codes. */
  generate(actor: PeriodActor, oaBrandId: number, onlyTypeCodes?: string[]): Promise<PeriodGenerationResult>;
}

export type PeriodAction = 'list' | 'create' | 'update' | 'delete';

export interface PeriodAccess {
  can(actor: PeriodActor, action: PeriodAction): Promise<boolean>;
}

export interface PeriodListFilters {
  periodTypes: IdName[];
  periodStatuses: IdName[];
  /** CI is_admin != 0: Lock / Unlock / Verify / Sync / Generate / Close. */
  canManage: boolean;
}

export interface PeriodFormInit {
  title: string;
  mode: 'add' | 'edit';
  record: PeriodRecord | null;
  periodTypes: IdName[];
  /** Edit only (CI shows the status dropdown in edit mode; add posts OPSA). */
  periodStatuses: IdName[];
  defaultStatusId: number | null;
  /** CI $data['buttons'] 'Verify Period' (edit of a not verified period). */
  canVerify: boolean;
}

export interface StartEndDates {
  periodStartDate: string;
  periodEndDate: string;
  fiscalPeriodDesc: string;
}
