import { BusinessRuleError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import {
  FIELD_CODES,
  PARENT_ANSWER_RULES,
  POST_SAVE_RULES,
  RADIO_SHOWS_RULES,
  SCREENS,
  SELECT_HIDES_RULES,
} from './moduleSettings.registry';
import { normaliseAnswer, saveBodySchema, validateAnswers } from './moduleSettings.validator';
import type {
  AttributeRecord,
  DependencyRule,
  FieldControl,
  IdName,
  ModuleSettingsReader,
  ModuleSettingsWriter,
  ReadScope,
  ScreenKey,
  ScreenModel,
  ScreenQuery,
  SettingField,
  SettingsAccess,
  SettingsActor,
  SettingsCache,
} from './moduleSettings.types';

/**
 * Business logic of CI setting_manager/change_module_settings (initForm, update → setFormControls,
 * syncModuleSettings). Depends only on the domain interfaces (constructor injection); wiring is in
 * lib/settingManager/index.ts.
 */

type CodeIds = { [K in keyof typeof FIELD_CODES]: number | null };

const toInt = (value: string | null): number => {
  const n = Number((value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

export class ModuleSettingsService {
  constructor(
    private readonly reader: ModuleSettingsReader,
    private readonly writer: ModuleSettingsWriter,
    private readonly access: SettingsAccess,
    private readonly cache: SettingsCache,
  ) {}

  /** CI index() → editChangeModuleSettings() → initForm(): everything the screen draws. */
  async load(actor: SettingsActor, query: ScreenQuery): Promise<ScreenModel> {
    await this.require(actor, 'view');
    const screen = SCREENS[query.screen];
    const scope = await this.scope(actor);
    const codes = await this.codeIds();

    const groups = await this.reader.groups(screen.groups, query, scope);
    const headers = await this.reader.headers(groups.map((g) => g.value));
    const allHeaderIds = [...headers.values()].flat().map((h) => h.value);
    const attributes = await this.reader.attributes(allHeaderIds, scope);
    const [options, answers] = await Promise.all([
      this.reader.options(attributes, codes.systemInput),
      // CI getSetAttrOptionIdByAttrId: super admin → system (brand 0) answers; others → brand, else brand 0.
      this.reader.answers(attributes.map((a) => a.attributeId), actor.adminLevel === 2 ? null : scope.sessionBrandId),
    ]);

    const fieldsByHeader = new Map<number, SettingField[]>();
    for (const attr of attributes) {
      const field = this.toField(attr, codes, options.get(attr.attributeId) ?? [], answers.get(attr.attributeId) ?? '');
      if (!field) continue;
      const list = fieldsByHeader.get(attr.headerId) ?? [];
      list.push(field);
      fieldsByHeader.set(attr.headerId, list);
    }

    const [canSave, canSync, filters, rules] = await Promise.all([
      this.access.can(actor, 'save'),
      actor.adminLevel === 1 ? this.access.can(actor, 'sync') : Promise.resolve(false),
      this.filters(query, scope, screen.showFilters, actor.adminLevel === 2),
      this.rules(query, attributes),
    ]);

    return {
      query,
      title: screen.title,
      syncTitle: screen.syncTitle,
      canSync,
      canSave,
      filters,
      // CI: a header without attributes is skipped; groups are drawn even when empty.
      groups: groups.map((g) => ({
        id: g.value,
        name: g.label,
        sections: (headers.get(g.value) ?? []).flatMap((h) => {
          const fields = fieldsByHeader.get(h.value) ?? [];
          return fields.length ? [{ id: h.value, title: h.label, fields }] : [];
        }),
      })),
      rules,
    };
  }

  /**
   * CI update() → setFormValidationRules + setFormControls: validate, write the answers and the
   * follow-up settings in one transaction, clear the cached settings.
   */
  async save(actor: SettingsActor, screenKey: ScreenKey, body: unknown): Promise<{ message: string; updated: number; inserted: number }> {
    await this.require(actor, 'save');
    const { answers: raw } = saveBodySchema.parse(body);
    const posted = new Map<number, string>(Object.entries(raw).map(([id, v]) => [Number(id), normaliseAnswer(v)]));

    const meta = new Map((await this.reader.attributesById([...posted.keys()])).map((a) => [a.attributeId, a]));
    const unknown = [...posted.keys()].filter((id) => !meta.has(id));
    if (unknown.length) {
      // CI wrote any posted id; only existing, non-deleted attributes are accepted here.
      throw new ValidationError('Validation failed.', { answers: [`Unknown settings: ${unknown.slice(0, 5).join(', ')}.`] });
    }

    const codes = await this.codeIds();
    const errors = validateAnswers(posted, meta, { number: codes.number, multipleChoice: codes.multipleChoice, date: codes.date }, actor.adminLevel !== 2);
    if (Object.keys(errors).length) throw new ValidationError('Validation failed.', errors);

    // CI: super admin writes brand 0 / org 0. Others wrote to the POSTED id (any brand could be
    // targeted) — behaviour change: the session brand is always used.
    const target = actor.adminLevel === 2 ? { oaId: 0, oaBrandId: 0 } : { oaId: actor.oaId, oaBrandId: this.sessionBrand(actor) };

    const rules = POST_SAVE_RULES.filter((r) => r.screens === 'all' || r.screens.includes(screenKey));
    const before = new Map<string, string | null>();
    for (const code of new Set(rules.flatMap((r) => r.beforeCodes ?? []))) {
      before.set(code, await this.reader.settingValue(code, target.oaBrandId));
    }
    const written = new Map<string, string>();
    for (const [attributeId, value] of posted) {
      const code = meta.get(attributeId)?.code;
      if (code) written.set(code, value);
    }
    const ctx = {
      written,
      before,
      targetBrandId: target.oaBrandId,
      read: (code: string, brandId: number) => this.reader.settingValue(code, brandId),
      masterName: (id: number) => this.reader.masterName(id),
    };
    const codeWrites = (await Promise.all(rules.map((r) => r.derive(ctx)))).flat();

    const result = await this.writer.saveAnswers({
      oaId: target.oaId,
      oaBrandId: target.oaBrandId,
      userId: actor.userId,
      answers: [...posted].map(([attributeId, value]) => ({ attributeId, value })),
      codeWrites,
    });
    // CI cache_delete_all(). (CI also stored session decimalPoint = SSADP; this app keeps no such session value.)
    this.cache.invalidateBrand(target.oaBrandId);
    return { message: SCREENS[screenKey].successMessage, ...result };
  }

  /** CI syncModuleSettings(): the session brand gets the system (brand 0) answers. */
  async sync(actor: SettingsActor): Promise<{ message: string; copied: number }> {
    // CI showed the Sync icon only to is_admin == 1 and did not check on the server.
    if (actor.adminLevel !== 1) throw new ForbiddenError('Only brand administrators can sync settings.');
    await this.require(actor, 'sync');
    const brandId = this.sessionBrand(actor);
    const { copied } = await this.writer.replaceWithDefaults({ oaId: actor.oaId, oaBrandId: brandId, userId: actor.userId });
    this.cache.invalidateBrand(brandId);
    return { message: `Successfully synced ${copied} setting(s) from the system defaults.`, copied };
  }

  // ------------------------------------------------------------------ helpers

  private async require(actor: SettingsActor, action: 'view' | 'save' | 'sync') {
    if (!(await this.access.can(actor, action))) throw new ForbiddenError('You do not have permission to change these settings.');
  }

  private sessionBrand(actor: SettingsActor): number {
    if (!actor.oaBrandId) throw new BusinessRuleError('Your session has no active brand.', 'NO_ACTIVE_BRAND');
    return actor.oaBrandId;
  }

  private async scope(actor: SettingsActor): Promise<ReadScope> {
    const brand = actor.oaBrandId ?? null;
    return {
      isSysAdmin: actor.adminLevel === 2,
      sessionBrandId: brand,
      // CI getSettingAttributeValue('SSABAN', brand): 0 when unset.
      sessionAppId: brand ? toInt(await this.reader.settingValue('SSABAN', brand)) : 0,
    };
  }

  private async codeIds(): Promise<CodeIds> {
    const keys = Object.keys(FIELD_CODES) as Array<keyof typeof FIELD_CODES>;
    const ids = await Promise.all(keys.map((k) => this.reader.masterId(FIELD_CODES[k])));
    return Object.fromEntries(keys.map((k, i) => [k, ids[i]])) as CodeIds;
  }

  /** CI view branches → one control per attribute; null when CI drew no input (no options). */
  private toField(attr: AttributeRecord, codes: CodeIds, options: IdName[], answer: string): SettingField | null {
    const dateOrTime = (): FieldControl => (attr.dataTypeId === codes.date ? 'date' : attr.dataTypeId === codes.time ? 'time' : 'text');
    let control: FieldControl;
    if (attr.inputValueTypeId === codes.systemInput) control = 'select';
    else if (attr.inputValueTypeId === codes.textOnly) control = dateOrTime();
    else {
      // CI: option-based attributes without any option render no input (and post nothing).
      if (options.length === 0) return null;
      if (attr.inputOptionTypeId === codes.radio) control = 'radio';
      else if (attr.inputOptionTypeId === codes.checkbox) control = 'checkbox';
      // CI repeated one textbox per option, all with the same name (only one value posted).
      else if (attr.inputOptionTypeId === codes.textbox) control = dateOrTime();
      else control = 'select';
    }
    return {
      attributeId: attr.attributeId,
      code: attr.code,
      label: attr.label,
      control,
      options: control === 'text' || control === 'date' || control === 'time' ? [] : options,
      value: control === 'checkbox' ? answer.split(',').map((v) => v.trim()).filter(Boolean) : answer,
      dependsOn: attr.dependsOn,
      required: attr.dataTypeId !== codes.multipleChoice,
      numeric: attr.dataTypeId === codes.number,
    };
  }

  private async filters(query: ScreenQuery, scope: ReadScope, show: boolean, isSysAdmin: boolean): Promise<ScreenModel['filters']> {
    if (!show) return { show: false, showFuncArea: false, modules: [], funcAreas: [], settingGroups: [] };
    const [modules, funcAreas, settingGroups] = await Promise.all([
      this.reader.enabledModules(scope),
      query.moduleId ? this.reader.funcAreas(query.moduleId) : Promise.resolve<IdName[]>([]),
      // CI getAllSettingGroups(0, $moduleId): SSABAN of brand 0.
      this.reader.settingValue('SSABAN', 0).then((v) => this.reader.groupsForModule(query.moduleId, toInt(v))),
    ]);
    // CI CSS hides the functional-area dropdown below super admin.
    return { show: true, showFuncArea: isSysAdmin, modules, funcAreas, settingGroups };
  }

  /** CI view script rules, built from the registry and the attributes on screen. */
  private async rules(query: ScreenQuery, attributes: AttributeRecord[]): Promise<DependencyRule[]> {
    const byCode = new Map(attributes.filter((a) => a.code).map((a) => [a.code as string, a.attributeId]));
    const rules: DependencyRule[] = [];

    const attendanceModuleId = await this.reader.masterId(PARENT_ANSWER_RULES.moduleCode);
    if (query.screen === 'module' && query.moduleId !== null && query.moduleId === attendanceModuleId) {
      const parentIds = [...new Set(attributes.flatMap((a) => (a.dependsOn ? [a.dependsOn] : [])))];
      const parents = await this.reader.attributesById(parentIds);
      for (const parent of parents) {
        const showWhen = parent.code ? PARENT_ANSWER_RULES.showWhenByParentCode[parent.code] : undefined;
        if (showWhen) rules.push({ kind: 'parentAnswer', parentAttributeId: parent.attributeId, showWhen });
      }
      if (rules.length) {
        for (const r of SELECT_HIDES_RULES) {
          const select = byCode.get(r.selectCode);
          const target = byCode.get(r.targetCode);
          if (select && target) rules.push({ kind: 'selectHides', selectAttributeId: select, whenLabel: r.whenLabel, targetAttributeId: target });
        }
      }
    }
    for (const r of RADIO_SHOWS_RULES) {
      const radio = byCode.get(r.radioCode);
      const target = byCode.get(r.targetCode);
      if (radio && target) rules.push({ kind: 'radioShows', radioAttributeId: radio, whenLabel: r.whenLabel, targetAttributeId: target });
    }
    return rules;
  }
}
