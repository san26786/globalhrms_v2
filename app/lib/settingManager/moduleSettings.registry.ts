import type { GroupSource, ScreenKey } from './moduleSettings.types';

/**
 * Configuration of the settings screens (Open/Closed): a new screen, a new follow-up write or a
 * new show/hide rule is a new entry here — the service does not change.
 * Every value comes from CI controllers/setting_manager/change_module_settings.php and its view.
 */

export interface ScreenConfig {
  /** CI $head['title'] / $data['title']. */
  title: string;
  /** CI $data['syncTitle'] (tooltip of the Sync icon). */
  syncTitle: string;
  /** CI flash message after update(). */
  successMessage: string;
  /** Where the setting groups come from (CI initForm branches). */
  groups: GroupSource;
  /** Module / functional area / group dropdowns (CI: only when $companySettings is empty). */
  showFilters: boolean;
}

export const SCREENS: Record<ScreenKey, ScreenConfig> = {
  module: {
    title: 'Module Setting',
    syncTitle: 'Sync Module Settings',
    successMessage: 'Successfully Updated Module Setting',
    // CI getSettingGroupsByModuleId($oaBrandID = 0, …): the app filter reads SSABAN of brand 0.
    groups: { kind: 'module', appBrand: 'zero' },
    showFilters: true,
  },
  // CI getSettingGroupsByCompanySetting($oaBrandID = 0): the app filter reads SSABAN of brand 0.
  CS: {
    title: 'Company Setting',
    syncTitle: 'Sync Company Settings',
    successMessage: 'Successfully Updated Company Setting',
    groups: { kind: 'settingType', typeCode: 'STBCS', appBrand: 'zero' },
    showFilters: false,
  },
  // CI getSettingGroupsBySystemSetting(): the app filter reads SSABAN of the session brand.
  SS: {
    title: 'System Setting',
    syncTitle: 'Sync System Settings',
    successMessage: 'Successfully Updated System Setting',
    groups: { kind: 'settingType', typeCode: 'STSAS', appBrand: 'session' },
    showFilters: false,
  },
};

/** Master codes that decide how a field is drawn and validated (CI initForm / setFormValidationRules). */
export const FIELD_CODES = {
  systemInput: 'SIVTS', // SETTING_INPUT_VALUE_TYPE: options are masters of SYSTEM_TYPE_ID
  textOnly: 'SIVTCO', // SETTING_INPUT_VALUE_TYPE: free text (date / time by data type)
  radio: 'SIOTR', // INPUT_OPTION_TYPE
  checkbox: 'SIOTC',
  textbox: 'SIOTT',
  date: 'GSDVTD', // GLOBAL_SETTING_DATA_TYPE
  time: 'GSDVTTM',
  number: 'GSDVTN', // → numeric rule
  multipleChoice: 'GSDVT', // → the only optional data type
} as const;

/** CI MODULEMENUITEM (const_helper.php): independent_mst.TYP_ID of module menu items. */
export const MODULE_MENU_ITEM_TYPE_ID = 83;

// ---------------------------------------------------------------- follow-up writes after a save

export interface PostSaveContext {
  /** Values posted in this save, by setting code. */
  written: Map<string, string>;
  /** Values captured BEFORE the save, by setting code (see `beforeCodes`). */
  before: Map<string, string | null>;
  /** The brand being written (0 for the super admin). */
  targetBrandId: number;
  /** CI getSettingAttributeValue(code, brand). */
  read(code: string, oaBrandId: number): Promise<string | null>;
  /** CI indp_mst_data_m::getMasterName(id). */
  masterName(id: number): Promise<string | null>;
}

export interface PostSaveRule {
  id: string;
  screens: ScreenKey[] | 'all';
  /** Codes whose stored value must be read before the save (CI read them before upsert). */
  beforeCodes?: string[];
  derive(ctx: PostSaveContext): Promise<Array<{ code: string; value: string }>>;
}

/** CI reads these after the upsert, so a value posted in this save wins over the stored one. */
const current = (ctx: PostSaveContext, code: string, brandId: number) =>
  ctx.written.has(code) ? Promise.resolve(ctx.written.get(code) ?? null) : ctx.read(code, brandId);

export const POST_SAVE_RULES: PostSaveRule[] = [
  {
    // CI: if ($companySettings == 'SS') { SSABAN ← SSAAN(0); SSAAV ← SSAAR(0); OASTOADN ← name of SSAAN }
    id: 'systemApplication',
    screens: ['SS'],
    async derive(ctx) {
      const appId = await current(ctx, 'SSAAN', 0);
      const revision = await current(ctx, 'SSAAR', 0);
      const writes: Array<{ code: string; value: string }> = [
        { code: 'SSABAN', value: appId ?? '' },
        { code: 'SSAAV', value: revision ?? '' },
      ];
      const numericAppId = Number(appId);
      const appName = Number.isInteger(numericAppId) && numericAppId > 0 ? await ctx.masterName(numericAppId) : null;
      writes.push({ code: 'OASTOADN', value: appName ?? '' });
      return writes;
    },
  },
  {
    // CI: if SSAAYSD (attendance year start date) changed, copy it to SSAAYS.
    id: 'attendanceYearStart',
    screens: 'all',
    beforeCodes: ['SSAAYSD'],
    async derive(ctx) {
      const before = ctx.before.get('SSAAYSD') ?? null;
      const after = await current(ctx, 'SSAAYSD', ctx.targetBrandId);
      return before !== after && after !== null ? [{ code: 'SSAAYS', value: after }] : [];
    },
  },
];

// ---------------------------------------------------------------- show / hide rules (view script)

/**
 * CI $parentIds: only on the Attendance module (MMIAT). A field whose DEPENDENT_ON_ATTRIBUTE_ID
 * points at one of these parents is shown when the parent's chosen label equals the value.
 */
export const PARENT_ANSWER_RULES = {
  moduleCode: 'MMIAT',
  showWhenByParentCode: { SSACMWHA: 'yes', SSAPAFLEEG: 'yes', SSAIBWD: 'no' } as Record<string, string>,
};

/** CI penalty type: "loss of pay" hides the leave-type field (emitted with the attendance rules). */
export const SELECT_HIDES_RULES = [
  { moduleCode: 'MMIAT', selectCode: 'SSAPENTYP', whenLabel: 'loss of pay', targetCode: 'SSATOLTCFP' },
];

/** CI device manager: "Share Biometric Device" = Yes shows the biometric number field (every screen). */
export const RADIO_SHOWS_RULES = [{ radioCode: 'SBDWOB', whenLabel: 'Yes', targetCode: 'BSUBPN' }];
