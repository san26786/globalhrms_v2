import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMatch } from 'date-fns';
import { z } from 'zod';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { BusinessRuleError, ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError, type FieldErrors } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { invalidateBrandContext } from '@/lib/session/brandContext';
import { mastersOfTypeCode, type IdLabel } from './shared';

/**
 * CI systmMngt/oa_brands ("Oa Brands") — the brand list, the brand form (editOaBrands) and delete.
 * The header's "View Company Info" opens the list (admins) or the active brand's form (users).
 *
 * Who may open / change which brand (CI checked nothing; editOaBrands even switched the session brand):
 *   sysadmin — any brand; organisation admin — their organisation's brands; user — their active brand,
 *   read-only fields as CI (name, code, ref, country, active, primary locked for users).
 * The list, as CI's getTableDtl scoping: sysadmin every brand, admin the active brand, user none.
 *
 * Behaviour changes:
 *  - opening a brand no longer switches the session to it (CI's editOaBrands did, and update relied on it);
 *  - Currency is saved (CI required it and dropped it); UPDATED_BY / UPDATED_ON are stamped;
 *  - edit checks name / code / email uniqueness against the other brands (CI's edit_unique rule did not
 *    exist), and no longer rejects punctuation in the name / code (CI's alpha_numeric on edit refused
 *    existing data such as "demo@");
 *  - the logo type check is case-insensitive (CI refused .PNG); the image-size check (≤ 1563 × 338) is
 *    not ported — CI only ever measured the already-stored logo;
 *  - a user cannot delete the brand they are working in;
 *  - NOT ported: "New brand" (CI's insert provisioned an admin user, domain, user group, currencies, leave
 *    types, company settings, module settings, roles, permissions, module subscriptions and periods — most
 *    steps copy nothing or fail with the migrated data and nothing in CI's UI links to it); the
 *    Brand / Employer export (its SQL was broken); the MSO-only affiliation fields; the hidden PAYE fields
 *    (shown nowhere — their values are kept).
 * Raw SQL: oa_brands rows are stored twice (identical copies): reads take one, updates hit both.
 */

const LOGO_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'jfif', 'tiff']);
const LOGO_MAX_BYTES = 10 * 1024 * 1024;

export interface BrandValues {
  OaBrandNm: string;
  OaBrandCd: string;
  compType: string;
  curr_name: string;
  RefId: string;
  telephone: string;
  email: string;
  website: string;
  contact: string;
  address: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  state: string;
  postcode: string;
  country: string;
  businessCategory: string;
  businessDesc: string;
  startdate: string;
  cessationdate: string;
  taxpaymeth: string;
  bankname: string;
  branchname: string;
  sortcode: string;
  accname: string;
  accno: string;
  payref: string;
  buildsref: string;
  bankphone: string;
  bankadd: string;
  brand_url: string;
  isActive: boolean;
  isPrimary: boolean;
}

export interface BrandFormInit {
  title: string;
  oaBrandId: number;
  values: BrandValues;
  logo: string | null;
  /** Fields locked for a normal user (CI readonly / disabled when is_admin == 0). */
  restricted: boolean;
  options: { companyTypes: IdLabel[]; currencies: IdLabel[]; countries: IdLabel[]; businessCategories: IdLabel[]; taxPaymentMethods: IdLabel[] };
}

interface BrandRow {
  OA_BRAND_ID: number;
  OA_ID: number | null;
  OA_BRAND_NM: string | null;
  OA_BRAND_CD: string | null;
  COMPANY_TYPE: number | null;
  CURRENCY_ID: number | null;
  REF_ID: number | null;
  TELEPHONE: string | null;
  EMAIL: string | null;
  WEBSITE: string | null;
  CONTACT: string | null;
  ADDRESS: string | null;
  ADDRESS_ONE: string | null;
  ADDRESS_TWO: string | null;
  CITY: string | null;
  STATE: string | null;
  ZIP: string | null;
  country: number | null;
  BUSINESS_CATEGORY: number | null;
  BUSINESS_DESC: string | null;
  START_DATE: string | null;
  CESSATION_DATE: string | null;
  TAX_PAYMENT_METHOD: number | null;
  BANK_NAME: string | null;
  BRANCH_NAME: string | null;
  SORT_CODE: string | null;
  ACCOUNT_NAME: string | null;
  ACCOUNT_NO: string | null;
  PAYMENT_REFERENCE: string | null;
  BUILDING_SOCIETY_REFRENCE: string | null;
  BANK_TELEPHONE: string | null;
  BANK_ADDRESS: string | null;
  BRAND_URL: string | null;
  OA_BRAND_LOGO: string | null;
  IS_ACTIVE: boolean | null;
  IS_PRIMARY: boolean | null;
}

async function findBrand(id: number): Promise<BrandRow | null> {
  const rows = await prisma.$queryRaw<BrandRow[]>`
    SELECT "OA_BRAND_ID", "OA_ID", "OA_BRAND_NM", "OA_BRAND_CD", "COMPANY_TYPE", "CURRENCY_ID", "REF_ID", "TELEPHONE", "EMAIL",
           "WEBSITE", "CONTACT", "ADDRESS", "ADDRESS_ONE", "ADDRESS_TWO", "CITY", "STATE", "ZIP", "country", "BUSINESS_CATEGORY",
           "BUSINESS_DESC", to_char("START_DATE", 'YYYY-MM-DD') AS "START_DATE", to_char("CESSATION_DATE", 'YYYY-MM-DD') AS "CESSATION_DATE",
           "TAX_PAYMENT_METHOD", "BANK_NAME", "BRANCH_NAME", "SORT_CODE", "ACCOUNT_NAME", "ACCOUNT_NO", "PAYMENT_REFERENCE",
           "BUILDING_SOCIETY_REFRENCE", "BANK_TELEPHONE", "BANK_ADDRESS", "BRAND_URL", "OA_BRAND_LOGO", "IS_ACTIVE", "IS_PRIMARY"
    FROM oa_brands WHERE "OA_BRAND_ID" = ${id} AND COALESCE("IS_DELETED", 0) = 0 LIMIT 1`;
  return rows[0] ?? null;
}

/** sysadmin: any; admin: own organisation's brands; user: active brand only. */
function assertCanOpen(subject: RequestSubject, brand: BrandRow): void {
  if (subject.adminLevel === 2) return;
  if (subject.adminLevel === 1 && subject.oaId !== null && brand.OA_ID === subject.oaId) return;
  if (brand.OA_BRAND_ID === subject.oaBrandId) return;
  throw new NotFoundError('Brand not found.');
}

/** CI invoice_setting_m::getAllCurrencyMst(): "{name} ({code})" of the brand's currencies. */
async function currencies(subject: RequestSubject, brand: number): Promise<IdLabel[]> {
  const rows = await prisma.$queryRaw<Array<{ value: number; label: string }>>`
    SELECT cm."CURR_ID" AS value,
           COALESCE(cm."CURR_NAME", '') || ' (' ||
             COALESCE((SELECT im."MSTR_CD" FROM independent_mst im WHERE im."MSTR_ID"::text = cm."CURR_CODE" LIMIT 1), cm."CURR_CODE") || ')' AS label
    FROM currency_mst cm
    WHERE cm."IS_DELETED" = 0 AND (${subject.adminLevel === 2} OR cm."OA_BRAND_ID" = ${brand})
    ORDER BY label, cm."CURR_ID"`;
  return rows.map((r) => ({ value: Number(r.value), label: r.label }));
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/* ------------------------------------------------------------------ validation (CI setFormValidationRules, update) */

const req = (label: string) => `The ${label} field is required.`;
const str = z.preprocess((v) => (typeof v === 'string' ? v.trim() : v ?? ''), z.string().max(1000));
const requiredStr = (label: string, max = 250) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v ?? ''), z.string().min(1, req(label)).max(max));
const positiveDigits = (label: string, max = 30) =>
  str.refine((v) => v === '' || (/^\d+$/.test(v) && v.length <= max), `The ${label} field must contain only positive numbers.`)
    .refine((v) => v === '' || Number(v) > 0, `The ${label} field cannot be zero or negative.`);
const date = (label: string) => str.refine((v) => v === '' || isMatch(v, 'yyyy-MM-dd'), `The ${label} field must contain a valid date.`);
// Legacy rows hold 0 for "none" in these columns.
const optionalId = z.preprocess((v) => (v === '' || v == null || v === '0' ? null : v), z.coerce.number().int().positive().nullable());

const saveSchema = z.object({
  OaBrandNm: requiredStr('OA Brand Name'),
  OaBrandCd: requiredStr('OA Brand Code', 50),
  compType: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number({ error: req('Company Type') }).int().positive(req('Company Type'))),
  curr_name: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number({ error: req('Currency') }).int().positive(req('Currency'))),
  RefId: str.refine((v) => v === '' || /^\d+$/.test(v), 'The Refrence field must contain only positive numbers.'),
  telephone: requiredStr('Telephone')
    .refine((v) => /^\d+$/.test(v), 'The Telephone field must contain only positive numbers.')
    .refine((v) => v.length <= 15, 'The Telephone field can not exceed 15 characters in length.')
    .refine((v) => Number(v) > 0, 'The Telephone field cannot be zero or negative.'),
  email: requiredStr('Email').pipe(z.string().email('The Email field must contain a valid email address.')),
  website: str,
  contact: requiredStr('Contact Name'),
  address: str,
  address_line_1: str,
  address_line_2: str,
  town: str,
  state: str,
  postcode: str,
  country: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number({ error: req('Country') }).int().positive(req('Country'))),
  businessCategory: optionalId,
  businessDesc: str,
  startdate: date('Date Of Formation(Start Date)'),
  cessationdate: date('Cessation Date(End Date)'),
  taxpaymeth: optionalId,
  bankname: str.refine((v) => v === '' || /^[a-z ]+$/i.test(v), 'The Bank Name field may only contain alphabetical characters.'),
  branchname: str,
  sortcode: str,
  accname: str,
  accno: positiveDigits('Account No'),
  payref: str,
  buildsref: str,
  bankphone: positiveDigits('Telephone'),
  bankadd: str,
  brand_url: str,
  isActive: z.preprocess((v) => v === true || v === '1' || v === 'true', z.boolean()),
  isPrimary: z.preprocess((v) => v === true || v === '1' || v === 'true', z.boolean()),
});

const nn = (v: string) => (v === '' ? null : v);

/** CI uploadFile1(): original name (spaces → _), numeric suffix when taken, into ORG_LOGO_DIR. */
async function storeLogo(file: File): Promise<string> {
  const dir = process.env.ORG_LOGO_DIR?.trim();
  if (!dir) {
    throw new ServiceUnavailableError('Logo storage is not configured: set ORG_LOGO_DIR to the organisation logo folder.', 'STORAGE_NOT_CONFIGURED');
  }
  const original = path.basename(file.name).replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = path.extname(original).slice(1).toLowerCase();
  if (!LOGO_EXT.has(ext)) throw new ValidationError('File Format Not Allowed.', { userfile: ['File Format Not Allowed.'] });
  if (file.size > LOGO_MAX_BYTES) throw new ValidationError('The logo is larger than 10 MB.', { userfile: ['The logo is larger than 10 MB.'] });
  await mkdir(dir, { recursive: true });
  const base = original.slice(0, original.length - ext.length - 1) || 'logo';
  for (let i = 0; i < 1000; i++) {
    const name = `${base}${i ? i : ''}.${ext}`;
    try {
      await access(path.join(dir, name));
    } catch {
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      return name;
    }
  }
  throw new ValidationError('Could not store the logo: too many files with this name.');
}

export const oaBrandsService = {
  /** CI index(): getTableDtl scoping (OA_BRAND_ID = session brand for admins, own rows for users). */
  async listScope(subject: RequestSubject) {
    if (subject.adminLevel === 2) return {};
    if (subject.adminLevel === 1 && subject.oaBrandId) return { equals: [{ column: 'OA_BRAND_ID', value: subject.oaBrandId }] };
    return { in: { column: 'OA_BRAND_ID', values: [] } };
  },

  async formInit(subject: RequestSubject, id: number): Promise<BrandFormInit> {
    const brand = await findBrand(id);
    if (!brand) throw new NotFoundError('Brand not found.');
    assertCanOpen(subject, brand);
    const [companyTypes, currencyOptions, countries, businessCategories, taxPaymentMethods] = await Promise.all([
      mastersOfTypeCode('ALCT'),
      currencies(subject, id),
      mastersOfTypeCode('HTGHN'),
      mastersOfTypeCode('BCAT'),
      mastersOfTypeCode('TPM'),
    ]);
    return {
      title: 'Edit Oa Brands',
      oaBrandId: brand.OA_BRAND_ID,
      logo: brand.OA_BRAND_LOGO || null,
      restricted: subject.adminLevel === 0,
      values: {
        OaBrandNm: s(brand.OA_BRAND_NM),
        OaBrandCd: s(brand.OA_BRAND_CD),
        compType: s(brand.COMPANY_TYPE),
        curr_name: brand.CURRENCY_ID ? s(brand.CURRENCY_ID) : '',
        RefId: s(brand.REF_ID),
        telephone: s(brand.TELEPHONE),
        email: s(brand.EMAIL),
        website: s(brand.WEBSITE),
        contact: s(brand.CONTACT),
        address: s(brand.ADDRESS),
        address_line_1: s(brand.ADDRESS_ONE),
        address_line_2: s(brand.ADDRESS_TWO),
        town: s(brand.CITY),
        state: s(brand.STATE),
        postcode: s(brand.ZIP),
        country: s(brand.country),
        businessCategory: s(brand.BUSINESS_CATEGORY),
        businessDesc: s(brand.BUSINESS_DESC),
        startdate: s(brand.START_DATE),
        cessationdate: s(brand.CESSATION_DATE),
        taxpaymeth: s(brand.TAX_PAYMENT_METHOD),
        bankname: s(brand.BANK_NAME),
        branchname: s(brand.BRANCH_NAME),
        sortcode: s(brand.SORT_CODE),
        accname: s(brand.ACCOUNT_NAME),
        accno: s(brand.ACCOUNT_NO),
        payref: s(brand.PAYMENT_REFERENCE),
        buildsref: s(brand.BUILDING_SOCIETY_REFRENCE),
        bankphone: s(brand.BANK_TELEPHONE),
        bankadd: s(brand.BANK_ADDRESS),
        brand_url: s(brand.BRAND_URL),
        isActive: brand.IS_ACTIVE !== false,
        isPrimary: brand.IS_PRIMARY === true,
      },
      options: { companyTypes, currencies: currencyOptions, countries, businessCategories, taxPaymentMethods },
    };
  },

  /** CI update() → setFormControls (update branch). `form` is the multipart body. */
  async save(subject: RequestSubject, id: number, form: FormData): Promise<{ message: string }> {
    const brand = await findBrand(id);
    if (!brand) throw new NotFoundError('Brand not found.');
    assertCanOpen(subject, brand);

    const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
    const v = saveSchema.parse(raw);
    // CI: name / code / ref (readonly) and country / active / primary (disabled) are locked for users.
    if (subject.adminLevel === 0) {
      v.OaBrandNm = s(brand.OA_BRAND_NM);
      v.OaBrandCd = s(brand.OA_BRAND_CD);
      v.RefId = s(brand.REF_ID);
      v.country = brand.country ?? v.country;
      v.isActive = brand.IS_ACTIVE !== false;
      v.isPrimary = brand.IS_PRIMARY === true;
    }

    const dupes = await prisma.$queryRaw<Array<{ nm: bigint; cd: bigint; em: bigint }>>`
      SELECT COUNT(*) FILTER (WHERE lower("OA_BRAND_NM") = lower(${v.OaBrandNm})) AS nm,
             COUNT(*) FILTER (WHERE lower("OA_BRAND_CD") = lower(${v.OaBrandCd})) AS cd,
             COUNT(*) FILTER (WHERE lower("EMAIL") = lower(${v.email})) AS em
      FROM oa_brands WHERE "OA_BRAND_ID" <> ${id} AND COALESCE("IS_DELETED", 0) = 0`;
    const errors: FieldErrors = {};
    if (Number(dupes[0]?.nm ?? 0) > 0) errors.OaBrandNm = ['The OA Brand Name field must contain a unique value.'];
    if (Number(dupes[0]?.cd ?? 0) > 0) errors.OaBrandCd = ['The OA Brand Code field must contain a unique value.'];
    if (Number(dupes[0]?.em ?? 0) > 0) errors.email = ['The Email field must contain a unique value.'];
    if (Object.keys(errors).length) throw new ValidationError('Please correct the highlighted fields.', errors);

    const file = form.get('userfile');
    const logo = file instanceof File && file.size > 0 ? await storeLogo(file) : brand.OA_BRAND_LOGO;

    await prisma.$executeRaw`
      UPDATE oa_brands SET
        "OA_BRAND_NM" = ${v.OaBrandNm}, "OA_BRAND_CD" = ${v.OaBrandCd}, "REF_ID" = ${v.RefId === '' ? null : Number(v.RefId)},
        "TELEPHONE" = ${v.telephone}, "EMAIL" = ${v.email}, "CONTACT" = ${v.contact}, "ADDRESS" = ${nn(v.address)},
        "START_DATE" = ${nn(v.startdate)}::date, "CESSATION_DATE" = ${nn(v.cessationdate)}::date,
        "TAX_PAYMENT_METHOD" = ${v.taxpaymeth}, "BANK_NAME" = ${nn(v.bankname)}, "BRANCH_NAME" = ${nn(v.branchname)},
        "SORT_CODE" = ${nn(v.sortcode)}, "ACCOUNT_NAME" = ${nn(v.accname)}, "ACCOUNT_NO" = ${nn(v.accno)},
        "PAYMENT_REFERENCE" = ${nn(v.payref)}, "BUILDING_SOCIETY_REFRENCE" = ${nn(v.buildsref)},
        "BANK_TELEPHONE" = ${nn(v.bankphone)}, "BANK_ADDRESS" = ${nn(v.bankadd)},
        "ADDRESS_ONE" = ${nn(v.address_line_1)}, "ADDRESS_TWO" = ${nn(v.address_line_2)}, "CITY" = ${nn(v.town)},
        "STATE" = ${nn(v.state)}, "ZIP" = ${nn(v.postcode)}, "country" = ${v.country}, "WEBSITE" = ${nn(v.website)},
        "COMPANY_TYPE" = ${v.compType}, "CURRENCY_ID" = ${v.curr_name}, "BUSINESS_CATEGORY" = ${v.businessCategory},
        "BUSINESS_DESC" = ${nn(v.businessDesc)}, "BRAND_URL" = ${nn(v.brand_url)}, "OA_BRAND_LOGO" = ${logo},
        "IS_ACTIVE" = ${v.isActive}, "IS_PRIMARY" = ${v.isPrimary},
        "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now()
      WHERE "OA_BRAND_ID" = ${id}`;
    invalidateBrandContext(id);
    return { message: 'Successfully Updated Oa Brand ID ' };
  },

  /** CI delete/{id}: soft delete (IS_DELETED = 1). */
  async remove(subject: RequestSubject, id: number): Promise<{ message: string }> {
    if (subject.adminLevel === 0) throw new ForbiddenError('Only administrators can delete a brand.');
    const brand = await findBrand(id);
    if (!brand) throw new NotFoundError('Brand not found.');
    assertCanOpen(subject, brand);
    if (id === subject.oaBrandId) throw new BusinessRuleError('You cannot delete the brand you are working in. Switch to another brand first.', 'ACTIVE_BRAND');
    await prisma.$executeRaw`UPDATE oa_brands SET "IS_DELETED" = 1, "UPDATED_BY" = ${subject.userId}, "UPDATED_ON" = now() WHERE "OA_BRAND_ID" = ${id}`;
    invalidateBrandContext(id);
    return { message: 'Successfully Deleted Oa Brand ' };
  },
};
