import { addDays, addMonths, addYears, format, parseISO } from 'date-fns';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError, type FieldErrors } from '@/lib/http/errors';
import { parseSettingDate } from '@/lib/utilities/periodGenerator';
import {
  ACTIVE_STATUS_CODE,
  BRAND_APP_SETTING_CODE,
  INACTIVE_STATUS_CODE,
  INACTIVE_STATUS_FALLBACK_ID,
  MESSAGES,
  PENDING_CHECKS,
  PERIOD_STATUS_TYPE_ID,
  PERIOD_TYPE_TYPE_ID,
  START_END_DIFF,
  START_END_DIFF_DEFAULT,
  TITLES,
  VERIFY_SETTING_CODE,
} from './period.registry';
import { periodIdsSchema, periodSaveSchema } from './period.validator';
import type {
  PeriodAccess,
  PeriodAction,
  PeriodActionResult,
  PeriodActor,
  PeriodFormInit,
  PeriodGeneratorPort,
  PeriodListFilters,
  PeriodMasters,
  PeriodMessages,
  PeriodRepository,
  PeriodSettings,
  StartEndDates,
} from './period.types';

/**
 * Period Master — port of CI periodMngt/period_mst (controller) + period_mst_m (model).
 * Single responsibility: the CI business rules. Storage, master data, settings, generation and
 * permissions are injected (see ./index.ts), so the rules can be tested with fakes.
 *
 * Behaviour changes from CI (each marked "Behaviour change" below):
 *  1. every action is limited to the caller's active brand (CI lock / unlock / close / delete took
 *     any PERIOD_ID posted);
 *  2. editing a period no longer fails "This Period Already Exists" on its own description;
 *  3. Close Period checks that EVERY selected period is verified (CI checked only the last one), and
 *     the Leave check looks at the period's leave requests (CI used an undefined variable);
 *  4. Syncronize Period works (CI's getAllBrands() returned nothing, so it never did anything);
 *  5. failures are errors (CI showed "Please Select …" as a success flash, and Delete showed
 *     "Successfully Deleted" even when it refused because the period was in use).
 */

export interface PeriodTypeDef {
  periodType: string;
  startCode: string;
  frequencyCode: string;
  typeCode: string;
}

type Level = keyof PeriodMessages;

function result(level: Level, message: string, affected = 0, extra: PeriodMessages = {}): PeriodActionResult {
  return { message, messages: { ...extra, [level]: message }, affected };
}

function isSet(value: string | null): boolean {
  return value !== null && value.trim() !== '' && value.trim() !== '0';
}

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function positiveInt(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export class PeriodService {
  constructor(
    private readonly repo: PeriodRepository,
    private readonly masters: PeriodMasters,
    private readonly settings: PeriodSettings,
    private readonly generator: PeriodGeneratorPort,
    private readonly access: PeriodAccess,
    private readonly typeDefs: readonly PeriodTypeDef[],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /* ------------------------------------------------------------------ list */

  /**
   * CI index($getPeriodId, $getPeriodStatusId): ONE static filter — the period type if given, else
   * the status if given, else "type IN (enabled period types)", else no rows ("1 = 2"). CI quirk kept:
   * with both a type and a status selected only the type filters.
   */
  async listScope(actor: PeriodActor, query: Record<string, string>) {
    const typeId = positiveInt(query.periodTypeId);
    if (typeId) return { equals: [{ column: 'PERIOD_TYPE_ID', value: typeId }] };
    const statusId = positiveInt(query.periodStatusId);
    if (statusId) return { equals: [{ column: 'PERIOD_STATUS_ID', value: statusId }] };
    const enabled = actor.oaBrandId ? await this.enabledTypes(actor) : [];
    return { in: { column: 'PERIOD_TYPE_ID', values: enabled.map((t) => t.value) } };
  }

  /** CI getCustomFields(): the Period Type / Period Status filters, plus which admin actions show. */
  async filters(actor: PeriodActor): Promise<PeriodListFilters> {
    await this.require(actor, 'list');
    const [periodTypes, periodStatuses, canUpdate] = await Promise.all([
      actor.oaBrandId ? this.enabledTypes(actor) : Promise.resolve([]),
      this.repo.mastersOfType(PERIOD_STATUS_TYPE_ID),
      this.access.can(actor, 'update'),
    ]);
    return { periodTypes, periodStatuses, canManage: actor.adminLevel !== 0 && canUpdate };
  }

  /* ------------------------------------------------------------------ form */

  /** CI initForm($id): titles, dropdowns, the record, and the edit-mode "Verify Period" button. */
  async formInit(actor: PeriodActor, periodId: number | null): Promise<PeriodFormInit> {
    const brand = this.brandOf(actor);
    await this.require(actor, periodId ? 'update' : 'create');
    const record = periodId ? await this.repo.find(periodId, brand) : null;
    if (periodId && !record) throw new NotFoundError('Period not found.');
    const [periodTypes, periodStatuses, defaultStatusId] = await Promise.all([
      this.repo.mastersOfType(PERIOD_TYPE_TYPE_ID), // CI getDataByTypeID(PERIODTYPE): every period type
      record ? this.repo.mastersOfType(PERIOD_STATUS_TYPE_ID) : Promise.resolve([]),
      this.masters.id(ACTIVE_STATUS_CODE),
    ]);
    return {
      title: record ? TITLES.edit : TITLES.add,
      mode: record ? 'edit' : 'add',
      record,
      periodTypes,
      periodStatuses,
      defaultStatusId,
      canVerify: !!record && !record.isVerified,
    };
  }

  /**
   * CI getStartEndDate($periodTypeId) — the form's period-type change: the day after the type's
   * latest active period, else the type's start-date setting; end by the frequency setting
   * (START_END_DIFF, CI quirks kept). Description as CI's script built it: "{type}  {year}".
   * Behaviour change: with no period and no start-date setting CI returned 1970-01-01; this is an
   * error now. Settings fall back to the system default like the generator.
   */
  async startEndDates(actor: PeriodActor, periodTypeId: number): Promise<StartEndDates> {
    const brand = this.brandOf(actor);
    await this.require(actor, 'list');
    const [typeCode, typeName, activeStatusId] = await Promise.all([
      this.masters.code(periodTypeId),
      this.masters.name(periodTypeId),
      this.masters.id(ACTIVE_STATUS_CODE),
    ]);
    if (!typeCode) throw new ValidationError('Please Select Period ID', { periodTypeId: ['Please Select Period ID'] });
    const def = this.typeDefs.find((d) => d.typeCode === typeCode);

    const [last, startRaw, frequencyRaw] = await Promise.all([
      this.repo.latestPeriod({ periodTypeId, oaBrandId: brand, activeStatusId }),
      def ? this.settings.valueOrDefault(def.startCode, brand) : Promise.resolve(null),
      def ? this.settings.valueOrDefault(def.frequencyCode, brand) : Promise.resolve(null),
    ]);

    let start: Date | null = null;
    if (last) start = addDays(parseISO(last.periodEndDate), 1);
    else if (startRaw) {
      const parsed = parseSettingDate(startRaw);
      start = parsed ? parseISO(parsed.toISOString().slice(0, 10)) : null;
    }
    if (!start) {
      throw new BusinessRuleError(`No start date is configured for ${typeName ?? 'this period type'}.`, 'PERIOD_START_NOT_CONFIGURED');
    }

    const diff = START_END_DIFF[(frequencyRaw ?? '').trim().toLowerCase()] ?? START_END_DIFF_DEFAULT;
    const end = addDays(addMonths(addYears(start, diff.years ?? 0), diff.months ?? 0), diff.days);
    const sy = start.getFullYear();
    const ey = end.getFullYear();
    return {
      periodStartDate: ymd(start),
      periodEndDate: ymd(end),
      fiscalPeriodDesc: `${typeName ?? ''}  ${sy === ey ? sy : `${sy} - ${ey}`}`,
    };
  }

  /**
   * CI insert() / update() → setFormValidationRules + setFormControls. Organisation, brand and
   * user: the active brand's on add (CI: the session's for normal users; admins posted them from the
   * form's organisation fields, which this form does not have), the record's own on edit.
   */
  async save(actor: PeriodActor, periodId: number | null, body: unknown): Promise<{ message: string; periodId: number }> {
    const brand = this.brandOf(actor);
    await this.require(actor, periodId ? 'update' : 'create');
    const input = periodSaveSchema.parse(body);
    const record = periodId ? await this.repo.find(periodId, brand) : null;
    if (periodId && !record) throw new NotFoundError('Period not found.');

    const activeStatusId = await this.masters.id(ACTIVE_STATUS_CODE);
    const errors: FieldErrors = {};

    // CI checkDateRange (rule on both dates): no other ACTIVE period of the type, in the session
    // brand, may contain the start or the end date.
    const [atStart, atEnd] = await Promise.all(
      [input.periodStartDate, input.periodEndDate].map((date) =>
        this.repo.periodCovering({ periodTypeId: input.periodTypeId, date, oaBrandId: brand, activeStatusId }),
      ),
    );
    const clash = (found: number | null) => found !== null && found !== periodId;
    if (clash(atStart) || clash(atEnd)) {
      errors.periodStartDate = [MESSAGES.periodInUse];
      errors.periodEndDate = [MESSAGES.periodInUse];
    }

    // CI checkPeriod: the description is unique in period_mst (every brand, deleted rows too).
    // Behaviour change: the period being edited is excluded (CI rejected every edit that kept it).
    if (await this.repo.descriptionExists(input.fiscalPeriodDesc, periodId)) {
      errors.fiscalPeriodDesc = [MESSAGES.descExists];
    }
    if (Object.keys(errors).length) throw new ValidationError('Please correct the highlighted fields.', errors);

    const statusId = record ? input.periodStatusId ?? record.periodStatusId : activeStatusId;
    if (!statusId) throw new ValidationError('Period status is not configured (OPSA).', { periodStatusId: ['Required.'] });

    const write = {
      ...input,
      periodStatusId: statusId,
      oaId: record?.oaId ?? actor.oaId ?? (await this.repo.brandOrgId(brand)) ?? 0,
      oaBrandId: record?.oaBrandId ?? brand,
      userId: record?.userId ?? actor.userId,
      actorId: actor.userId,
      now: this.clock(),
    };
    if (record) {
      await this.repo.update(record.periodId, write);
      return { message: MESSAGES.updated, periodId: record.periodId };
    }
    const id = await this.repo.insert(write);
    return { message: MESSAGES.added, periodId: id };
  }

  /* ------------------------------------------------------------------ row / list actions */

  /** CI delete($id) / Delete Selected: refused while any selected period is used by another module. */
  async remove(actor: PeriodActor, rawIds: unknown): Promise<PeriodActionResult> {
    const brand = this.brandOf(actor);
    await this.require(actor, 'delete');
    const ids = this.ids(rawIds, 'Please Select Period(s) to Delete');
    if ((await this.repo.referenceCount(ids)) > 0) throw new BusinessRuleError(MESSAGES.inUse, 'PERIOD_IN_USE');
    const affected = await this.repo.softDelete(ids, brand);
    if (!affected) throw new NotFoundError('Period not found.');
    return result('success', MESSAGES.deleted, affected);
  }

  /** CI verifyPeriod(): only once the brand's period settings were verified (setting SSACVPS). */
  async verify(actor: PeriodActor, rawIds: unknown): Promise<PeriodActionResult> {
    const brand = this.brandOf(actor);
    await this.require(actor, 'update');
    const ids = this.ids(rawIds, MESSAGES.selectToVerify);
    if (!isSet(await this.settings.value(VERIFY_SETTING_CODE, brand))) {
      throw new BusinessRuleError(MESSAGES.verifySettingsFirst, 'PERIOD_SETTINGS_NOT_VERIFIED');
    }
    const affected = await this.repo.setVerified(ids, brand);
    return result('success', MESSAGES.verified, affected);
  }

  /** CI lockPeriod() (admins). */
  async lock(actor: PeriodActor, rawIds: unknown): Promise<PeriodActionResult> {
    const brand = await this.requireManager(actor);
    const ids = this.ids(rawIds, MESSAGES.selectToLock);
    return result('success', MESSAGES.locked, await this.repo.setLocked(ids, brand, true));
  }

  /** CI unlockPeriod() (admins): unlocks the selection when at least one of it is locked. */
  async unlock(actor: PeriodActor, rawIds: unknown): Promise<PeriodActionResult> {
    const brand = await this.requireManager(actor);
    const ids = this.ids(rawIds, MESSAGES.selectToUnlock);
    if ((await this.repo.countLocked(ids, brand)) === 0) throw new BusinessRuleError(MESSAGES.selectLocked, 'PERIOD_NOT_LOCKED');
    return result('success', MESSAGES.unlocked, await this.repo.setLocked(ids, brand, false));
  }

  /**
   * CI endProcedure() "Close Period" (admins): verified periods only; sets PERIOD_ENDED and the
   * Inactive status, then reports pending requests of the module using each period — the period is
   * closed regardless, as in CI. (CI's "generate the next period" step was commented out: not done.)
   */
  async close(actor: PeriodActor, rawIds: unknown): Promise<PeriodActionResult> {
    const brand = await this.requireManager(actor);
    const ids = this.ids(rawIds, MESSAGES.selectToVerify); // CI text
    // Behaviour change: every selected period must be verified (CI checked only the last one).
    if ((await this.repo.countUnverified(ids, brand)) > 0) throw new BusinessRuleError(MESSAGES.verifySelected, 'PERIOD_NOT_VERIFIED');

    const inactive = (await this.masters.id(INACTIVE_STATUS_CODE)) ?? INACTIVE_STATUS_FALLBACK_ID;
    const ended = await this.repo.endPeriods(ids, brand, inactive);

    const warnings = new Set<string>();
    for (const { periodId, periodTypeId } of ended) {
      const code = periodTypeId ? await this.masters.code(periodTypeId) : null;
      const check = PENDING_CHECKS.find((c) => c.typeCode === code);
      if (check && (await this.repo.pendingCount(check, periodId)) > 0) warnings.add(check.message);
    }
    const extra: PeriodMessages = warnings.size ? { warning: [...warnings].join('. ') } : {};
    return result('success', MESSAGES.ended, ended.length, extra);
  }

  /** CI generatePeriod() "Generate the Period" (admins): the shared period generator, active brand. */
  async generate(actor: PeriodActor): Promise<PeriodActionResult> {
    const brand = await this.requireManager(actor);
    const run = await this.generator.generate(actor, brand);
    return this.fromGeneration(run.messages, run.results.reduce((n, r) => n + r.count, 0));
  }

  /**
   * CI syncPeriod() "Syncronize Period" (admins) — Behaviour change: CI never ran (getAllBrands()
   * returned nothing). What it was written to do: for each period type whose latest period has
   * already ended (end date <= today), generate the next periods; types with no period or with a
   * future end are skipped. "No new period was generated." when nothing was generated.
   */
  async sync(actor: PeriodActor): Promise<PeriodActionResult> {
    const brand = await this.requireManager(actor);
    const typed = await Promise.all(this.typeDefs.map(async (d) => ({ def: d, id: await this.masters.id(d.typeCode) })));
    const known = typed.filter((t): t is { def: PeriodTypeDef; id: number } => t.id !== null);
    const ends = await this.repo.latestEndDates(known.map((t) => t.id), brand);
    const today = ymd(this.clock());
    const due = known.filter((t) => {
      const end = ends.get(t.id);
      return !!end && end <= today;
    });
    if (!due.length) return result('danger', MESSAGES.noNewPeriod);

    const run = await this.generator.generate(actor, brand, due.map((t) => t.def.typeCode));
    const generated = run.results.reduce((n, r) => n + r.count, 0);
    // CI: without a success message the danger flash is replaced by "No new period was generated."
    const messages = run.messages.success ? run.messages : { ...run.messages, danger: MESSAGES.noNewPeriod };
    return this.fromGeneration(messages, generated);
  }

  /* ------------------------------------------------------------------ helpers */

  private async enabledTypes(actor: PeriodActor) {
    const brand = actor.oaBrandId!;
    const appId = Number(await this.settings.value(BRAND_APP_SETTING_CODE, brand)) || 0;
    return this.repo.enabledPeriodTypes(brand, appId, actor.adminLevel === 2);
  }

  private fromGeneration(messages: PeriodMessages, affected: number): PeriodActionResult {
    const message = messages.success ?? messages.warning ?? messages.danger ?? MESSAGES.noNewPeriod;
    return { message, messages, affected };
  }

  private brandOf(actor: PeriodActor): number {
    if (!actor.oaBrandId) throw new BusinessRuleError('Select a brand first.', 'NO_ACTIVE_BRAND');
    return actor.oaBrandId;
  }

  private ids(raw: unknown, emptyMessage: string): number[] {
    const { ids } = periodIdsSchema.parse(raw ?? {});
    if (!ids.length) throw new ValidationError(emptyMessage, { ids: [emptyMessage] });
    return ids;
  }

  private async require(actor: PeriodActor, action: PeriodAction): Promise<void> {
    if (!(await this.access.can(actor, action))) throw new ForbiddenError();
  }

  /** CI listActions shown only when is_admin != 0 (Lock / Unlock / Close / Sync / Generate). */
  private async requireManager(actor: PeriodActor): Promise<number> {
    const brand = this.brandOf(actor);
    if (actor.adminLevel === 0) throw new ForbiddenError('Only administrators can do this.');
    await this.require(actor, 'update');
    return brand;
  }
}
