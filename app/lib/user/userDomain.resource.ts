import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/http/errors';
import { ResourceService, menuPolicy, type ResourceDefinition } from '@/lib/resource';
import { userDomainSchema, type UserDomainInput } from '@/validations/user.schema';
import { ACTIVE_BOOL, createTargetBrand, nameMaps, num, str } from './userScope';

/**
 * User Domain — CI controllers/user/user_domain.php (list of user_domain_vw).
 *
 * Preserved: Domain Name required; "Combination of Domain Name And Brand already exists";
 * list scoping sysadmin all / admin own organisation (ORG_ACC_ID) / user own rows (USERID);
 * soft delete. Org / brand / "requested by" are stamped from the session; a sysadmin may choose the
 * brand (CI OrgDetailsView). Fixed: the uniqueness check excludes the record being edited and
 * deleted rows, is case-insensitive, and cannot be bypassed by editing the brand.
 */
export interface UserDomainDto {
  id: number;
  name: string;
  description: string | null;
  oaId: number;
  oaBrandId: number;
  organisation: string | null;
  brandName: string | null;
  requestedBy: string | null;
}

async function assertUnique(name: string, oaBrandId: number | null, exceptId?: number) {
  const clash = await prisma.user_domain.findFirst({
    where: {
      DMN_NM: { equals: name, mode: 'insensitive' },
      OA_BRAND_ID: oaBrandId ?? -1,
      ...ACTIVE_BOOL,
      ...(exceptId ? { NOT: { DMN_ID: exceptId } } : {}),
    },
    select: { DMN_ID: true },
  });
  if (clash) {
    const message = 'Combination of Domain Name And Brand already exists';
    throw new ConflictError(message, { name: [message] });
  }
}

const toData = (i: UserDomainInput) => ({ DMN_NM: i.name, DSCRPTN: i.description });

const definition: ResourceDefinition<UserDomainInput, UserDomainInput, UserDomainDto> = {
  label: 'User domain',
  model: 'user_domain',
  primaryKey: 'DMN_ID',
  searchFields: ['DMN_NM', 'DSCRPTN'],
  sortFields: ['DMN_ID', 'DMN_NM', 'OA_BRAND_ID'],
  defaultSort: { field: 'DMN_ID', dir: 'desc' },
  tenancy: {
    mode: 'ci',
    scopeBy: 'org',
    orgColumn: 'OA_ID',
    brandColumn: 'OA_BRAND_ID',
    userColumn: 'USER_ID',
    sysAdminMayChooseBrand: true,
  },
  softDelete: { column: 'IS_DELETED', deleted: true, active: false, nullIsActive: true },
  audit: { createdBy: 'CREATED_BY', createdOn: 'CREATED_ON', updatedBy: 'UPDATED_BY', updatedOn: 'UPDATED_ON' },
  policy: menuPolicy('user/user_domain'),
  createSchema: userDomainSchema,
  updateSchema: userDomainSchema,
  toCreateData: toData,
  toUpdateData: toData,
  hooks: {
    beforeCreate: (i, ctx) => assertUnique(i.name, createTargetBrand(ctx.subject, i.oaBrandId)),
    beforeUpdate: (id, i, existing) => assertUnique(i.name, num(existing.OA_BRAND_ID), id),
    async enrichRows(rows) {
      const names = await nameMaps(rows, { user: ['USER_ID'], brand: 'OA_BRAND_ID', org: 'OA_ID' });
      return rows.map((r) => ({
        ...r,
        _org: names.org.get(r.OA_ID as number) ?? null,
        _brand: names.brand.get(r.OA_BRAND_ID as number) ?? null,
        _requestedBy: names.user.get(r.USER_ID as number) ?? null,
      }));
    },
  },
  toDto: (r) => ({
    id: r.DMN_ID as number,
    name: (r.DMN_NM as string) ?? '',
    description: str(r.DSCRPTN),
    oaId: r.OA_ID as number,
    oaBrandId: r.OA_BRAND_ID as number,
    organisation: str(r._org),
    brandName: str(r._brand),
    requestedBy: str(r._requestedBy),
  }),
};

export const userDomainService = new ResourceService(definition);
