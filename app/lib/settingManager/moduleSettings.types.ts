/**
 * Module / Company / System Settings (CI setting_manager/change_module_settings) — DOMAIN.
 * Interfaces and types only: no Prisma, no Next.js. The service depends on these; the Prisma
 * repository implements them; lib/settingManager/index.ts wires the two together.
 */

/** CI is_admin: 0 user, 1 brand admin, 2 super admin. Structurally satisfied by RequestSubject. */
export interface SettingsActor {
  adminLevel: 0 | 1 | 2;
  userId: number;
  oaId: number | null;
  oaBrandId: number | null;
}

/** CI URL forms: index/{module}/{funcArea}/{group} (module), index/0/0/0/CS, index/0/0/0/SS. */
export type ScreenKey = 'module' | 'CS' | 'SS';

export interface ScreenQuery {
  screen: ScreenKey;
  moduleId: number | null;
  funcAreaId: number | null;
  settingGroupId: number | null;
}

export interface IdName {
  value: number;
  label: string;
}

/** How a field is drawn (CI viewChange_module_settings_v branches). */
export type FieldControl = 'select' | 'radio' | 'checkbox' | 'text' | 'date' | 'time';

export interface SettingField {
  attributeId: number;
  /** setting_group_attribute_mst.SYSTEM_SETTING_ATTRIBUTE_CD */
  code: string | null;
  label: string;
  control: FieldControl;
  options: IdName[];
  /** Current answer: one value, or the ids of a checkbox field. */
  value: string | string[];
  /** DEPENDENT_ON_ATTRIBUTE_ID (CI data-parentid). */
  dependsOn: number | null;
  required: boolean;
  numeric: boolean;
}

export interface SettingSection {
  id: number;
  title: string;
  fields: SettingField[];
}

export interface SettingGroupView {
  id: number;
  name: string;
  sections: SettingSection[];
}

/** Client show/hide rule (CI $parentIds, penalty select, biometric toggle). */
export type DependencyRule =
  | { kind: 'parentAnswer'; parentAttributeId: number; showWhen: string }
  | { kind: 'selectHides'; selectAttributeId: number; whenLabel: string; targetAttributeId: number }
  | { kind: 'radioShows'; radioAttributeId: number; whenLabel: string; targetAttributeId: number };

export interface ScreenModel {
  query: ScreenQuery;
  title: string;
  syncTitle: string;
  /** CI: the Sync icon only for is_admin == 1. */
  canSync: boolean;
  canSave: boolean;
  filters: {
    show: boolean;
    showFuncArea: boolean;
    modules: IdName[];
    funcAreas: IdName[];
    settingGroups: IdName[];
  };
  groups: SettingGroupView[];
  rules: DependencyRule[];
}

// ---------------------------------------------------------------- repository contracts

/** One attribute's metadata, as read from setting_group_attribute_mst. */
export interface AttributeRecord {
  attributeId: number;
  headerId: number;
  code: string | null;
  label: string;
  inputValueTypeId: number | null;
  inputOptionTypeId: number | null;
  dataTypeId: number | null;
  answerGroupId: number | null;
  systemTypeId: number | null;
  dependsOn: number | null;
}

/** Group source of a screen (registry), resolved by the reader. */
/** appBrand: whose SSABAN filters the groups — CI passes brand 0 in some calls, the session brand in others. */
export type GroupSource =
  | { kind: 'settingType'; typeCode: string; appBrand: 'zero' | 'session' }
  | { kind: 'module'; appBrand: 'zero' | 'session' };

/** Read side (ISP: the service's load path depends only on this). */
export interface ModuleSettingsReader {
  /** CI master code → id (getMasterIDFromCode); null when missing. */
  masterId(code: string): Promise<number | null>;
  /** CI indp_mst_data_m::getMasterName(id). */
  masterName(id: number): Promise<string | null>;
  /** CI getSettingAttributeValue(code, brand): the brand's application id etc. */
  settingValue(code: string, oaBrandId: number): Promise<string | null>;
  groups(source: GroupSource, query: ScreenQuery, scope: ReadScope): Promise<IdName[]>;
  headers(groupIds: number[]): Promise<Map<number, IdName[]>>;
  attributes(headerIds: number[], scope: ReadScope): Promise<AttributeRecord[]>;
  /** Options per attribute: system-type masters or answer-group values. */
  options(attributes: AttributeRecord[], systemInputTypeId: number | null): Promise<Map<number, IdName[]>>;
  /** CI getSetAttrOptionIdByAttrId: the brand's answer, else the system (brand 0) answer. */
  answers(attributeIds: number[], oaBrandId: number | null): Promise<Map<number, string>>;
  /** Attribute metadata for validation / follow-up rules. */
  attributesById(attributeIds: number[]): Promise<AttributeRecord[]>;
  enabledModules(scope: ReadScope): Promise<IdName[]>;
  funcAreas(moduleId: number): Promise<IdName[]>;
  groupsForModule(moduleId: number | null, appId: number): Promise<IdName[]>;
}

export interface ReadScope {
  isSysAdmin: boolean;
  /** The session brand (CI session oaBrandID). */
  sessionBrandId: number | null;
  /** SSABAN of the session brand (attribute / module filters). */
  sessionAppId: number;
}

export interface AnswerWrite {
  attributeId: number;
  value: string;
}

/** Write side (ISP: save / sync depend only on this). Every call is one transaction. */
export interface ModuleSettingsWriter {
  /**
   * CI oa_brand_setting_attribute_mst_m::upsert (+ updateValueByAttributeCode for `codeWrites`):
   * update the brand's answer row or insert one.
   */
  saveAnswers(command: {
    oaId: number | null;
    oaBrandId: number;
    userId: number;
    answers: AnswerWrite[];
    codeWrites: Array<{ code: string; value: string }>;
  }): Promise<{ updated: number; inserted: number }>;
  /** CI syncModuleSettings: replace the brand's answers with the system (brand 0) answers. */
  replaceWithDefaults(command: { oaId: number | null; oaBrandId: number; userId: number }): Promise<{ copied: number }>;
}

/** Authorization (DIP: the service does not know how menu grants are evaluated). */
export interface SettingsAccess {
  can(actor: SettingsActor, action: 'view' | 'save' | 'sync'): Promise<boolean>;
}

/** Cache invalidation after a write (CI $this->db->cache_delete_all()). */
export interface SettingsCache {
  invalidateBrand(oaBrandId: number): void;
}
