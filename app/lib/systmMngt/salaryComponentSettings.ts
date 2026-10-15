import { isMatch } from 'date-fns';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { BusinessRuleError, NotFoundError, ValidationError, type FieldErrors } from '@/lib/http/errors';
import { getMasterId } from '@/lib/masters/masterService';
import { prisma } from '@/lib/prisma';
import { menuPolicy } from '@/lib/resource/policies';
import { activeBrand, authorize, brandOrgId, mastersOfTypeCode, requireBrandAdmin, type IdLabel } from './shared';

/**
 * CI systmMngt/salary_component_settings (menu "Salary Component"): list (salary_component_settings_vw,
 * see prisma/sql/views), add / edit form, delete, "Synced Salary Component" (brand admins) and the
 * form's live calculation (getCompTypeConfig).
 *
 * Behaviour changes:
 *  - brand-scoped: edit / update / delete / resequencing only touch the active brand's rows (CI used
 *    the id alone, and resequencing shifted every brand's components);
 *  - resequencing no longer shifts the component just inserted (CI excluded id 0, i.e. nothing);
 *  - SIGN keeps its value on edit (the form has no SIGN field, so CI wiped it to NULL on every save);
 *  - delete is a soft delete (IS_DELETED = 1; CI's row delete was a hard delete, its bulk delete soft);
 *  - Sync refuses when no system template rows exist (CI deleted the brand's components and copied
 *    nothing — the database has no template rows today) and runs in one transaction;
 *  - empty optional fields are stored as NULL (PostgreSQL rejects '' for numbers / dates).
 * CI rules kept: "Component Calc Type" is checked against the brand's oa_brand_settings percentage
 * for the chosen Payroll Comp Calc Type (missing → "Please check your setting"); the components of
 * that calc type may not total more than 100 (Constant is not checked).
 * Raw SQL: audit columns hold NULLs the Prisma model declares required.
 */

const MENU = 'systmMngt/salary_component_settings';

/** CI getOabsCodeForSetting(): payroll calc type master → oa_brand_settings attribute code. */
const CALC_TYPE_SETTING: Record<string, string> = { PCCTF: 'OASAPCTF', PCCTV: 'OASAPCTV', PCCTC: 'OASAPCTC' };

export interface SalaryComponentValues {
  componentId: string;
  componentSequence: string;
  componentType: string;
  payGroupHead: string;
  payrollCompCalcType: string;
  componentCalcType: string;
  componentCalcTypeConfig: string;
  isAnnual: boolean;
  taxableStatus: string;
  otApplicable: boolean;
  otIncluded: boolean;
  effectiveFrom: string;
  latestCalculated: string;
  isEnabled: boolean;
  visibleInAnnexure: boolean;
  visibleInSalary: boolean;
}

export interface SalaryComponentFormInit {
  title: string;
  mode: 'add' | 'edit';
  values: SalaryComponentValues | null;
  options: { components: IdLabel[]; componentTypes: IdLabel[]; payGroupHeads: IdLabel[]; payrollCalcTypes: IdLabel[]; taxableStatuses: IdLabel[] };
}

interface Row {
  SC_ID: number;
  COMPONENT_ID: number | null;
  COMPONENT_SEQUENCE: number | null;
  COMPONENT_TYPE: number | null;
  PAY_GROUP_HEAD: number | null;
  PAYROLL_COMP_CALC_TYPE: number | null;
  COMPONENT_CALC_TYPE: number | null;
  COMPONENT_CALC_TYPE_CONFIG: number | null;
  IS_ANNUAL: number | null;
  TAXABLE_STATUS: number | null;
  OT_APPLICABLE: number | null;
  OT_INCLUDED: number | null;
  EFFECTIVE_FROM: string | null;
  LATEST_CALCULATED: number | null;
  IS_ENABLED: number | null;
  VISIBLE_IN_ANNEXURE: number | null;
  VISIBLE_IN_SALARY: number | null;
}

async function findRow(id: number, brand: number): Promise<Row | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "SC_ID", "COMPONENT_ID", "COMPONENT_SEQUENCE", "COMPONENT_TYPE", "PAY_GROUP_HEAD", "PAYROLL_COMP_CALC_TYPE",
           "COMPONENT_CALC_TYPE", "COMPONENT_CALC_TYPE_CONFIG", "IS_ANNUAL", "TAXABLE_STATUS", "OT_APPLICABLE", "OT_INCLUDED",
           to_char("EFFECTIVE_FROM", 'YYYY-MM-DD') AS "EFFECTIVE_FROM", "LATEST_CALCULATED", "IS_ENABLED", "VISIBLE_IN_ANNEXURE", "VISIBLE_IN_SALARY"
    FROM salary_component_settings
    WHERE "SC_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0
    LIMIT 1`;
  return rows[0] ?? null;
}

/** CI oa_brand_settings_m::getOabsValue(brand, code): the brand's percentage for a calc type. */
async function brandPercent(brand: number, settingCode: string): Promise<string | null> {
  const attributeId = await getMasterId(settingCode);
  if (!attributeId) return null;
  const rows = await prisma.$queryRaw<Array<{ v: string | null }>>`
    SELECT "OABS_SETTING_VALUE" AS v FROM oa_brand_settings
    WHERE "OA_BRAND_ID" = ${brand} AND "OABS_ATTRBUTE_ID" = ${attributeId}
    ORDER BY "OAB_SETTING_ID" LIMIT 1`;
  const v = rows[0]?.v;
  return v && v.trim() !== '' && v.trim() !== '0' ? v.trim() : null;
}

/** Payroll calc type master id → its setting code (null when not Fixed / Variable / Constant). */
async function settingCodeOf(payrollCalcType: number | null): Promise<string | null> {
  if (!payrollCalcType) return null;
  for (const [master, setting] of Object.entries(CALC_TYPE_SETTING)) {
    if ((await getMasterId(master)) === payrollCalcType) return setting;
  }
  return null;
}

const opt = (v: unknown) => (v === '' || v === undefined ? null : v);
const flag = z.preprocess((v) => v === true || v === 1 || v === '1', z.boolean());
const optionalId = z.preprocess(opt, z.coerce.number().int().positive().nullable());
const optionalNumber = (label: string) => z.preprocess(opt, z.coerce.number({ error: `The ${label} field must contain only numbers.` }).nullable());

const saveSchema = z.object({
  componentId: z.preprocess(opt, z.coerce.number({ error: 'The Component field is required.' }).int().positive('The Component field is required.')),
  componentSequence: z.preprocess(
    opt,
    z.coerce.number({ error: 'The Component Sequence field is required.' }).int('The Component Sequence field must contain only numbers.'),
  ),
  componentType: z.preprocess(opt, z.coerce.number({ error: 'The Component Type field is required.' }).int().positive('The Component Type field is required.')),
  payGroupHead: optionalId,
  payrollCompCalcType: optionalId,
  componentCalcType: optionalNumber('Component Calculation Type'),
  componentCalcTypeConfig: optionalNumber('Component Calc Type Config'),
  isAnnual: flag,
  taxableStatus: optionalId,
  otApplicable: flag,
  otIncluded: flag,
  effectiveFrom: z.preprocess(opt, z.string().refine((v) => isMatch(v, 'yyyy-MM-dd'), 'The Effective From field must contain a valid date.').nullable()),
  latestCalculated: optionalNumber('Latest Calculated'),
  isEnabled: flag,
  visibleInAnnexure: flag,
  visibleInSalary: flag,
});

type SaveInput = z.infer<typeof saveSchema>;

/** CI checkPayrollLimit($componentCalcType). */
async function checkPayrollLimit(input: SaveInput, brand: number, id: number | null): Promise<string | null> {
  const code = await settingCodeOf(input.payrollCompCalcType);
  if (code === 'OASAPCTC') return null;
  if (!code || !(await brandPercent(brand, code))) return 'Please check your setting';
  const rows = await prisma.$queryRaw<Array<{ total: number | null }>>`
    SELECT SUM("COMPONENT_CALC_TYPE") AS total FROM salary_component_settings
    WHERE "PAYROLL_COMP_CALC_TYPE" = ${input.payrollCompCalcType} AND "OA_BRAND_ID" = ${brand} AND "SC_ID" <> ${id ?? 0}`;
  const total = (input.componentCalcType ?? 0) + Number(rows[0]?.total ?? 0);
  return total > 100 ? 'Value exceeding setting limit' : null;
}

const toInt = (b: boolean) => (b ? 1 : 0);

export const salaryComponentSettingsService = {
  async formInit(subject: RequestSubject, id: number | null): Promise<SalaryComponentFormInit> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    const row = id ? await findRow(id, brand) : null;
    if (id && !row) throw new NotFoundError('Salary component not found.');
    const [components, componentTypes, payGroupHeads, payrollCalcTypes, taxableStatuses] = await Promise.all(
      ['PSC', 'CMPT', 'PGH', 'PCCT', 'SETS'].map((c) => mastersOfTypeCode(c)),
    );
    const s = (v: number | null) => (v === null ? '' : String(v));
    return {
      title: row ? 'Edit Salary Component Configuration' : 'New Salary Component Configuration',
      mode: row ? 'edit' : 'add',
      values: row
        ? {
            componentId: s(row.COMPONENT_ID),
            componentSequence: s(row.COMPONENT_SEQUENCE),
            componentType: s(row.COMPONENT_TYPE),
            payGroupHead: s(row.PAY_GROUP_HEAD),
            payrollCompCalcType: s(row.PAYROLL_COMP_CALC_TYPE),
            componentCalcType: s(row.COMPONENT_CALC_TYPE),
            componentCalcTypeConfig: s(row.COMPONENT_CALC_TYPE_CONFIG),
            isAnnual: row.IS_ANNUAL === 1,
            taxableStatus: s(row.TAXABLE_STATUS),
            otApplicable: row.OT_APPLICABLE === 1,
            otIncluded: row.OT_INCLUDED === 1,
            effectiveFrom: row.EFFECTIVE_FROM ?? '',
            latestCalculated: s(row.LATEST_CALCULATED),
            isEnabled: row.IS_ENABLED === 1,
            visibleInAnnexure: row.VISIBLE_IN_ANNEXURE === 1,
            visibleInSalary: row.VISIBLE_IN_SALARY === 1,
          }
        : null,
      options: { components, componentTypes, payGroupHeads, payrollCalcTypes, taxableStatuses },
    };
  },

  /** CI insert() / update() → setFormControls → model insert / update + resequenceComponents. */
  async save(subject: RequestSubject, id: number | null, body: unknown): Promise<{ message: string; id: number }> {
    await authorize(subject, MENU, id ? 'update' : 'create');
    const brand = activeBrand(subject);
    if (id && !(await findRow(id, brand))) throw new NotFoundError('Salary component not found.');
    const v = saveSchema.parse(body);

    const limit = await checkPayrollLimit(v, brand, id);
    if (limit) throw new ValidationError(limit, { componentCalcType: [limit] } satisfies FieldErrors);

    if (!id) await assertInsertSafe('salary_component_settings', 'SC_ID');
    const oaId = await brandOrgId(brand, subject.oaId);

    const savedId = await prisma.$transaction(async (tx) => {
      let rowId = id;
      if (id) {
        await tx.$executeRaw`
          UPDATE salary_component_settings SET
            "COMPONENT_ID" = ${v.componentId}, "COMPONENT_SEQUENCE" = ${v.componentSequence}, "COMPONENT_TYPE" = ${v.componentType},
            "PAY_GROUP_HEAD" = ${v.payGroupHead}, "PAYROLL_COMP_CALC_TYPE" = ${v.payrollCompCalcType},
            "COMPONENT_CALC_TYPE" = ${v.componentCalcType}, "COMPONENT_CALC_TYPE_CONFIG" = ${v.componentCalcTypeConfig},
            "IS_ANNUAL" = ${toInt(v.isAnnual)}, "TAXABLE_STATUS" = ${v.taxableStatus}, "OT_APPLICABLE" = ${toInt(v.otApplicable)},
            "OT_INCLUDED" = ${toInt(v.otIncluded)}, "EFFECTIVE_FROM" = ${v.effectiveFrom}::date, "LATEST_CALCULATED" = ${v.latestCalculated},
            "IS_ENABLED" = ${toInt(v.isEnabled)}, "VISIBLE_IN_ANNEXURE" = ${toInt(v.visibleInAnnexure)},
            "VISIBLE_IN_SALARY" = ${toInt(v.visibleInSalary)}, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
          WHERE "SC_ID" = ${id} AND "OA_BRAND_ID" = ${brand}`;
      } else {
        const inserted = await tx.$queryRaw<Array<{ id: number }>>`
          INSERT INTO salary_component_settings (
            "COMPONENT_ID", "COMPONENT_SEQUENCE", "COMPONENT_TYPE", "PAY_GROUP_HEAD", "PAYROLL_COMP_CALC_TYPE",
            "COMPONENT_CALC_TYPE", "COMPONENT_CALC_TYPE_CONFIG", "IS_ANNUAL", "SIGN", "TAXABLE_STATUS", "OT_APPLICABLE",
            "OT_INCLUDED", "EFFECTIVE_FROM", "LATEST_CALCULATED", "IS_ENABLED", "VISIBLE_IN_ANNEXURE", "VISIBLE_IN_SALARY",
            "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
          VALUES (
            ${v.componentId}, ${v.componentSequence}, ${v.componentType}, ${v.payGroupHead}, ${v.payrollCompCalcType},
            ${v.componentCalcType}, ${v.componentCalcTypeConfig}, ${toInt(v.isAnnual)}, NULL, ${v.taxableStatus},
            ${toInt(v.otApplicable)}, ${toInt(v.otIncluded)}, ${v.effectiveFrom}::date, ${v.latestCalculated}, ${toInt(v.isEnabled)},
            ${toInt(v.visibleInAnnexure)}, ${toInt(v.visibleInSalary)}, ${oaId}, ${brand}, ${subject.userId},
            ${subject.userId}, now())
          RETURNING "SC_ID" AS id`;
        rowId = Number(inserted[0].id);
      }
      // CI resequenceComponents: when another component already has this sequence, shift it and the
      // following ones down by one (this brand only, the saved component excluded).
      const clash = await tx.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM salary_component_settings
        WHERE "COMPONENT_SEQUENCE" = ${v.componentSequence} AND "SC_ID" <> ${rowId} AND "OA_BRAND_ID" = ${brand}
          AND COALESCE("IS_DELETED", 0) = 0`;
      if (Number(clash[0]?.n ?? 0) > 0) {
        await tx.$executeRaw`
          UPDATE salary_component_settings SET "COMPONENT_SEQUENCE" = "COMPONENT_SEQUENCE" + 1
          WHERE "COMPONENT_SEQUENCE" >= ${v.componentSequence} AND "SC_ID" <> ${rowId} AND "OA_BRAND_ID" = ${brand}
            AND COALESCE("IS_DELETED", 0) = 0`;
      }
      return rowId!;
    });

    return {
      message: id ? 'Successfully Updated Salary Component Configuration' : 'Successfully Added Salary Component Configuration',
      id: savedId,
    };
  },

  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    await authorize(subject, MENU, 'delete');
    const brand = activeBrand(subject);
    const n = await prisma.$executeRaw`
      UPDATE salary_component_settings SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "SC_ID" = ${id} AND "OA_BRAND_ID" = ${brand} AND COALESCE("IS_DELETED", 0) = 0`;
    if (!n) throw new NotFoundError('Salary component not found.');
    return { message: 'Successfully Deleted' };
  },

  /** CI sync_comp_settings → replicateSalaryComponentSettings: copy the system template (brand 0 / NULL). */
  async sync(subject: RequestSubject): Promise<{ message: string; copied: number }> {
    await authorize(subject, MENU, 'update');
    requireBrandAdmin(subject);
    const brand = activeBrand(subject);
    const templates = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM salary_component_settings
      WHERE ("OA_BRAND_ID" = 0 OR "OA_BRAND_ID" IS NULL) AND COALESCE("IS_DELETED", 0) = 0`;
    if (Number(templates[0]?.n ?? 0) === 0) {
      throw new BusinessRuleError('No system salary component template exists to sync from.', 'NO_DEFAULTS');
    }
    await assertInsertSafe('salary_component_settings', 'SC_ID');
    const oaId = await brandOrgId(brand, subject.oaId);
    const copied = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM salary_component_settings WHERE "OA_BRAND_ID" = ${brand}`;
      return tx.$executeRaw`
        INSERT INTO salary_component_settings (
          "COMPONENT_ID", "COMPONENT_SEQUENCE", "COMPONENT_TYPE", "PAY_GROUP_HEAD", "PAYROLL_COMP_CALC_TYPE",
          "COMPONENT_CALC_TYPE", "COMPONENT_CALC_TYPE_CONFIG", "IS_ANNUAL", "SIGN", "TAXABLE_STATUS", "OT_APPLICABLE",
          "OT_INCLUDED", "EFFECTIVE_FROM", "LATEST_CALCULATED", "IS_ENABLED", "VISIBLE_IN_SALARY", "VISIBLE_IN_ANNEXURE",
          "OA_ID", "OA_BRAND_ID", "USER_ID", "CREATED_BY", "CREATED_ON")
        SELECT "COMPONENT_ID", "COMPONENT_SEQUENCE", "COMPONENT_TYPE", "PAY_GROUP_HEAD", "PAYROLL_COMP_CALC_TYPE",
          "COMPONENT_CALC_TYPE", "COMPONENT_CALC_TYPE_CONFIG", "IS_ANNUAL", "SIGN", "TAXABLE_STATUS", "OT_APPLICABLE",
          "OT_INCLUDED", "EFFECTIVE_FROM", "LATEST_CALCULATED", "IS_ENABLED", "VISIBLE_IN_SALARY", "VISIBLE_IN_ANNEXURE",
          ${oaId}, ${brand}, ${subject.userId}, ${subject.userId}, now()
        FROM salary_component_settings
        WHERE ("OA_BRAND_ID" = 0 OR "OA_BRAND_ID" IS NULL) AND COALESCE("IS_DELETED", 0) = 0`;
    });
    return { message: 'Synced Salary Component', copied };
  },

  /**
   * CI getCompTypeConfig($cct, $pcct, $brand) — the form's focus-out calculation: Component Calc
   * Type × the brand's percentage for the payroll calc type / 100.
   */
  async compTypeConfig(subject: RequestSubject, cctRaw: string, pcctRaw: string) {
    await authorize(subject, MENU, 'list');
    const brand = activeBrand(subject);
    const cct = Number(cctRaw);
    const code = await settingCodeOf(Number(pcctRaw) || null);
    const value = code ? await brandPercent(brand, code) : null;
    if (!value || !Number.isFinite(cct)) return { success: false as const, msg: 'Please check your setting' };
    return { success: true as const, result: (cct * Number(value)) / 100 };
  },

  /** Header actions the list shows (CI: Sync only for is_admin == 1). */
  async listCapabilities(subject: RequestSubject) {
    await authorize(subject, MENU, 'list');
    return { canSync: subject.adminLevel === 1 && (await menuPolicy(MENU).check(subject, 'update')) };
  },
};
