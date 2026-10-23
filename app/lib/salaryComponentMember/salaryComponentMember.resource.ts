import type { RequestSubject } from '@/lib/auth/getSubject';
import { ForbiddenError, ValidationError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { activeBrand } from '@/lib/systmMngt/shared';
import { salaryComponentMemberSchema, type SalaryComponentMemberInput } from '@/validations/salaryComponentMember.schema';

/**
 * CI salaryComponentMember/salarycomponentmember (Advance Settings → "Component Member") on the
 * generic resource engine. The list is the CI list view (listDefinitions 'salary_component_member',
 * salarycomponentmember_vw); create / read / update / delete go through ResourceService.
 *
 * A member row says "component TYPE_ID is part of component COMPONENT_ID, calculated in position
 * COMPONENT_MEMBER_CAL_SEQ, as an Addition / Deduction / Contribution (COMPONENT_TYPE_ID)". Payroll
 * generation (lib/systmMngt/employeePayments) reads the enabled "Cost to Company" members in that order.
 *
 * Scoping as CI getTableDtl (orgColumn OABRANDID, userColumn USERID): admins their brand, users
 * their own rows, sysadmin all. Rows are stamped with the session brand (one is required).
 * Behaviour changes: the same member may be added to a component only once per brand, and a
 * component cannot be its own member (payroll would pay a duplicate twice); delete is a soft delete.
 */
const MENU = 'salaryComponentMember/salarycomponentmember';
const policy = menuPolicy(MENU);

export interface SalaryComponentMemberDto {
  id: number;
  componentId: number;
  typeId: number;
  calcSequence: number;
  componentTypeId: number;
  isEnabled: boolean;
}

async function assertUnique(input: SalaryComponentMemberInput, brand: number, id: number | null): Promise<void> {
  const duplicate = await prisma.salarycomponentmember.count({
    where: {
      COMPONENT_ID: input.componentId,
      TYPE_ID: input.typeId,
      OA_BRAND_ID: brand,
      IS_DELETED: 0,
      ...(id ? { NOT: { SALARY_COMP_MEMBER_ID: id } } : {}),
    },
  });
  if (duplicate) {
    const msg = 'This member is already added to the component.';
    throw new ValidationError(msg, { typeId: [msg] });
  }
}

const toData = (i: SalaryComponentMemberInput) => ({
  COMPONENT_ID: i.componentId,
  TYPE_ID: i.typeId,
  COMPONENT_MEMBER_CAL_SEQ: i.calcSequence,
  COMPONENT_TYPE_ID: i.componentTypeId,
  IS_ENABLED: i.isEnabled ? 1 : 0,
});

const definition: ResourceDefinition<SalaryComponentMemberInput, SalaryComponentMemberInput, SalaryComponentMemberDto> = {
  label: 'Component member',
  model: 'salarycomponentmember',
  primaryKey: 'SALARY_COMP_MEMBER_ID',
  // Only these: the audit columns hold NULLs (CI rows) the Prisma model declares required.
  select: {
    SALARY_COMP_MEMBER_ID: true,
    COMPONENT_ID: true,
    TYPE_ID: true,
    COMPONENT_MEMBER_CAL_SEQ: true,
    COMPONENT_TYPE_ID: true,
    IS_ENABLED: true,
    OA_BRAND_ID: true,
  },
  sortFields: ['SALARY_COMP_MEMBER_ID', 'COMPONENT_ID', 'COMPONENT_MEMBER_CAL_SEQ'],
  defaultSort: { field: 'COMPONENT_MEMBER_CAL_SEQ', dir: 'asc' },
  filters: {
    componentId: { column: 'COMPONENT_ID', parse: Number },
  },
  tenancy: { mode: 'ci', orgColumn: 'OA_ID', brandColumn: 'OA_BRAND_ID', userColumn: 'USER_ID' },
  softDelete: { column: 'IS_DELETED', deleted: 1, active: 0 },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATE_ON' },
  policy,
  createSchema: salaryComponentMemberSchema,
  updateSchema: salaryComponentMemberSchema,
  toCreateData: (i) => ({ ...toData(i), IS_DELETED: 0 }),
  toUpdateData: toData,
  hooks: {
    async beforeCreate(input, { subject }) {
      await assertUnique(input, activeBrand(subject), null);
    },
    async beforeUpdate(id, input, existing) {
      await assertUnique(input, Number(existing.OA_BRAND_ID), id);
    },
  },
  toDto: (r) => ({
    id: r.SALARY_COMP_MEMBER_ID as number,
    componentId: r.COMPONENT_ID as number,
    typeId: r.TYPE_ID as number,
    calcSequence: r.COMPONENT_MEMBER_CAL_SEQ as number,
    componentTypeId: r.COMPONENT_TYPE_ID as number,
    isEnabled: r.IS_ENABLED === 1,
  }),
};

export const salaryComponentMemberService = new ResourceService(definition);

/**
 * Form default: member component → its Component Type in the active brand's Salary Component
 * settings (picking a member pre-fills Component Type).
 */
export async function componentTypeDefaults(subject: RequestSubject): Promise<Record<string, string>> {
  if (!(await policy.check(subject, 'list'))) throw new ForbiddenError();
  const rows = await prisma.$queryRaw<Array<{ component: number; type: number }>>`
    SELECT DISTINCT ON ("COMPONENT_ID") "COMPONENT_ID" AS component, "COMPONENT_TYPE" AS type
    FROM salary_component_settings
    WHERE "OA_BRAND_ID" = ${activeBrand(subject)} AND COALESCE("IS_DELETED", 0) = 0
      AND "COMPONENT_ID" IS NOT NULL AND "COMPONENT_TYPE" IS NOT NULL
    ORDER BY "COMPONENT_ID", "SC_ID"`;
  return Object.fromEntries(rows.map((r) => [String(r.component), String(r.type)]));
}
