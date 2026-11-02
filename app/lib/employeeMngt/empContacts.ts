import type { Prisma } from '@/generated/prisma/client';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { getMasterId } from '@/lib/masters/masterService';

/**
 * CI oa_contact_emails_m::getOAContactIDByEmail / oa_contact_phones_m::getOAContactIDByPhone — an
 * employee's e-mail and phone are not stored on emp_mst but linked through the contact tables:
 *
 *   contact_mst (REF_EMP_ID = the employee's login user)
 *     → email_address_mst / phone_nbr_mst (the address / number, shared)
 *     → contact_emails / contact_phones (contact ↔ address)
 *     → oa_contacts (the contact in the organisation)
 *     → oa_contact_emails / oa_contact_phones (per brand; its id is what emp_mst.OA_CNTCT_EML_ID /
 *       OA_CNTCT_PHONE_ID hold)
 *
 * Every step reuses an existing row or adds one. Run inside the caller's transaction.
 *
 * Behaviour changes: the contact is the employee's own login user (CI used the "Requested By" user,
 * i.e. the admin, so new e-mails were attached to the admin's contact); a contact_emails / _phones row
 * is reused only when it belongs to that contact (CI reused another contact's); CI's extra bare
 * oa_contact_* row without a contact is not written; the saved phone becomes the primary one (CI left
 * every phone of the contact non-primary).
 */

type Tx = Prisma.TransactionClient;

export interface ContactOwner {
  /** emp_mst.REF_EMP_ID — the employee's login user. */
  userId: number;
  empId: number;
  oaId: number | null;
  oaBrandId: number;
  /** The user making the change (audit columns). */
  actorId: number;
}

async function first<T>(rows: Promise<T[]>): Promise<T | undefined> {
  return (await rows)[0];
}

/** CI's relation type of a relative's contact (emergency contacts, dependents). */
export const RELATIVE_RELTYPE = 615;

/**
 * contact_mst of the user; added from user_mst when missing (CI phone path). CI also stamped the
 * logged-in user's id on the contacts of relatives it added, so those are skipped.
 */
export async function contactOf(tx: Tx, o: ContactOwner): Promise<number> {
  const found = await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT cm."CNTCT_ID" AS id FROM contact_mst cm
    WHERE cm."REF_EMP_ID" = ${o.userId}
      AND NOT EXISTS (SELECT 1 FROM oa_contacts oc WHERE oc."CNTCT_ID" = cm."CNTCT_ID" AND oc."OA_CNTCT_RELTYPE_ID" = ${RELATIVE_RELTYPE})
    ORDER BY cm."CNTCT_ID" LIMIT 1`);
  if (found) return found.id;
  await assertInsertSafe('contact_mst', 'CNTCT_ID');
  const [row] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO contact_mst ("REF_EMP_ID", "CNTCT_FRST_NM", "OA_BRAND_ID", "OA_ID_ORIGINATED", "USER_ID", "CREATED_BY", "CREATED_ON")
    SELECT ${o.userId}, left(COALESCE(u."USER_NAME", ''), 40), ${o.oaBrandId}, ${o.oaId}, ${o.userId}, ${o.actorId}, now()
    FROM (SELECT ${o.userId}::int AS id) x LEFT JOIN user_mst u ON u."USER_ID" = x.id
    RETURNING "CNTCT_ID" AS id`;
  return row.id;
}

/** oa_contacts of the contact; added when missing (company contact type NPCT). */
async function orgContactOf(tx: Tx, o: ContactOwner, contactId: number): Promise<number> {
  const found = await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT "OA_CNTCTS_ID" AS id FROM oa_contacts WHERE "CNTCT_ID" = ${contactId} ORDER BY "OA_CNTCTS_ID" LIMIT 1`);
  if (found) return found.id;
  const npct = await getMasterId('NPCT');
  await assertInsertSafe('oa_contacts', 'OA_CNTCTS_ID');
  const [row] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO oa_contacts ("OA_CNTCT_RELTYPE_ID", "CNTCT_ID", "NON_PRSNL", "NON_PRSNL_CNTCT_TYP", "IS_ACTIVE", "OA_ID", "OA_BRAND_ID",
                             "USER_ID", "CREATED_BY", "CREATED_ON")
    VALUES (0, ${contactId}, false, ${npct}, true, ${o.oaId}, ${o.oaBrandId}, ${o.userId}, ${o.actorId}, now())
    RETURNING "OA_CNTCTS_ID" AS id`;
  return row.id;
}

/** The employee's contact in the organisation (oa_contacts id), created along the chain when missing. */
export async function employeeOrgContact(tx: Tx, o: ContactOwner): Promise<number> {
  return orgContactOf(tx, o, await contactOf(tx, o));
}

/** Links `email` as the employee's primary e-mail; returns the oa_contact_emails id for emp_mst.OA_CNTCT_EML_ID. */
export async function linkEmail(tx: Tx, o: ContactOwner, email: string): Promise<number> {
  return saveEmail(tx, o, email, { emailType: await getMasterId('EAUTPE'), primary: true });
}

export interface EmailOptions {
  emailType: number | null;
  /** Make it the primary e-mail (the others of the contact in the brand stop being primary). */
  primary: boolean;
  /** The oa_contact_emails row being edited (Employee Email screen); otherwise the row of this address is reused or added. */
  recordId?: number;
}

/**
 * Links `email` to the employee (Employee Manager, Employee Email screen); returns the oa_contact_emails
 * id. Editing re-links the row to the (possibly new) address — the shared email_address_mst row is never
 * renamed, as CI did.
 */
export async function saveEmail(tx: Tx, o: ContactOwner, email: string, opts: EmailOptions): Promise<number> {
  const contactId = await contactOf(tx, o);

  let addressId = (await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT "EMAIL_ADD_ID" AS id FROM email_address_mst
    WHERE lower("EMAIL_ADD") = lower(${email}) AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "EMAIL_ADD_ID" LIMIT 1`))?.id;
  if (!addressId) {
    await assertInsertSafe('email_address_mst', 'EMAIL_ADD_ID');
    [{ id: addressId }] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO email_address_mst ("EMAIL_ADD", "OA_ID_ORIGINATED", "OA_BRAND_ID", "USER_ID", "CREATEDBY", "CREATEDON")
      VALUES (${email}, ${o.oaId}, ${o.oaBrandId}, ${o.userId}, ${o.actorId}, now())
      RETURNING "EMAIL_ADD_ID" AS id`;
  }

  let linkId = (await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT "CNTCT_EML_ID" AS id FROM contact_emails
    WHERE "CNTCT_ID" = ${contactId} AND "EMAIL_ADD_ID" = ${addressId} AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "CNTCT_EML_ID" LIMIT 1`))?.id;
  if (!linkId) {
    await assertInsertSafe('contact_emails', 'CNTCT_EML_ID');
    [{ id: linkId }] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO contact_emails ("CNTCT_ID", "EMAIL_ADD_ID", "OA_ID_ORIGINATED", "OA_BRAND_ID", "USER_ID", "IS_PRIMARY", "CREATED_BY", "CREATED_ON", "UPDATED_ON")
      VALUES (${contactId}, ${addressId}, ${o.oaId}, ${o.oaBrandId}, ${o.userId}, false, ${o.actorId}, now(), now())
      RETURNING "CNTCT_EML_ID" AS id`;
  }

  const orgContactId = await orgContactOf(tx, o, contactId);
  const primary = opts.primary ? '1' : '0';
  if (opts.primary) {
    await tx.$executeRaw`
      UPDATE oa_contact_emails SET "IS_PRIMARY" = '0'
      WHERE "OA_CNTCT_ID" = ${orgContactId} AND "OA_BRAND_ID" = ${o.oaBrandId} AND "OA_CNTCT_EML_ID" <> ${opts.recordId ?? -1}`;
  }
  const existing = opts.recordId
    ? { id: opts.recordId }
    : await first(tx.$queryRaw<Array<{ id: number }>>`
        SELECT "OA_CNTCT_EML_ID" AS id FROM oa_contact_emails
        WHERE "CNTCT_EML_ID" = ${String(linkId)} AND "OA_BRAND_ID" = ${o.oaBrandId} ORDER BY "OA_CNTCT_EML_ID" LIMIT 1`);
  if (existing) {
    await tx.$executeRaw`
      UPDATE oa_contact_emails SET "OA_CNTCT_ID" = ${orgContactId}, "CNTCT_EML_ID" = ${String(linkId)}, "IS_PRIMARY" = ${primary}, "IS_EMP" = 1,
        "EMAIL_TYPE_ID" = ${opts.emailType}, "OA_ID" = ${o.oaId}, "OA_BRAND_ID" = ${o.oaBrandId}, "USER_ID" = ${o.userId},
        "IS_DELETED" = 0, "UPDATED_BY" = ${o.actorId}, "UPDATED_ON" = now()
      WHERE "OA_CNTCT_EML_ID" = ${existing.id}`;
    return existing.id;
  }
  await assertInsertSafe('oa_contact_emails', 'OA_CNTCT_EML_ID');
  const [row] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO oa_contact_emails ("OA_CNTCT_ID", "CNTCT_EML_ID", "EMAIL_TYPE_ID", "OA_ID", "OA_BRAND_ID", "IS_PRIMARY", "IS_EMP",
                                   "USER_ID", "CREATED_BY", "CREATED_ON", "UPDATED_ON")
    VALUES (${orgContactId}, ${String(linkId)}, ${opts.emailType}, ${o.oaId}, ${o.oaBrandId}, ${primary}, 1, ${o.userId}, ${o.actorId}, now(), now())
    RETURNING "OA_CNTCT_EML_ID" AS id`;
  return row.id;
}

/** Links `phone` (with its country code id) as the employee's primary phone; returns the oa_contact_phones id. */
export async function linkPhone(tx: Tx, o: ContactOwner, phone: string, countryCode: string): Promise<number> {
  return savePhone(tx, o, phone, countryCode, { phoneType: await getMasterId('PNTCL'), primary: true });
}

export interface PhoneOptions {
  phoneType: number | null;
  /** Make it the primary phone (the employee's other phones in the brand stop being primary). */
  primary: boolean;
  /** The oa_contact_phones row being edited (Employee Phone screen); otherwise the row of this number is reused or added. */
  recordId?: number;
}

/** Links `phone` to the employee (Employee Manager, Employee Phone screen); returns the oa_contact_phones id. */
export async function savePhone(tx: Tx, o: ContactOwner, phone: string, countryCode: string, opts: PhoneOptions): Promise<number> {
  const contactId = await contactOf(tx, o);
  const linkId = await contactPhoneLink(tx, o, contactId, phone, countryCode);

  const orgContactId = await orgContactOf(tx, o, contactId);
  const primary = opts.primary ? '1' : '0';
  const phoneType = opts.phoneType ? String(opts.phoneType) : null;
  if (opts.primary) {
    await tx.$executeRaw`
      UPDATE oa_contact_phones SET "IS_PRIMARY" = '0'
      WHERE "OA_CNTCT_ID" = ${orgContactId} AND "OA_BRAND_ID" = ${o.oaBrandId} AND "OA_CNTCT_PHONE_ID" <> ${opts.recordId ?? -1}`;
  }
  return writeOrgPhone(tx, o, { orgContactId, linkId, phone, countryCode, phoneType, primary, isEmp: 1, empId: o.empId, recordId: opts.recordId });
}

/** The phone number row (phone_nbr_mst, shared) and its link to the contact (contact_phones), reused or added; returns the link id. */
export async function contactPhoneLink(
  tx: Tx, o: Pick<ContactOwner, 'oaId' | 'oaBrandId' | 'actorId'> & { userId: number | null }, contactId: number, phone: string, countryCode: string,
): Promise<number> {
  let numberId = (await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT "PHONE_NBR_ID" AS id FROM phone_nbr_mst
    WHERE "PHONE_NBR" = ${phone} AND COALESCE("IS_DELETED", false) = false ORDER BY "PHONE_NBR_ID" LIMIT 1`))?.id;
  if (!numberId) {
    const cell = await getMasterId('PNTCL');
    await assertInsertSafe('phone_nbr_mst', 'PHONE_NBR_ID');
    [{ id: numberId }] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO phone_nbr_mst ("PHONE_NBR", "PHONE_NBR_TYPE_ID", "PHONE_COUNTRY_CD", "IS_FAXNBR", "OA_ID_ORIGINATED", "OA_BRAND_ID",
                                 "USER_ID", "CREATED_BY", "CREATED_ON")
      VALUES (${phone}, ${cell ?? 0}, ${countryCode.slice(0, 5) || null}, false, ${o.oaId}, ${o.oaBrandId}, ${o.userId}, ${o.actorId}, now())
      RETURNING "PHONE_NBR_ID" AS id`;
  }

  let linkId = (await first(tx.$queryRaw<Array<{ id: number }>>`
    SELECT "CNTCT_PHONE_ID" AS id FROM contact_phones
    WHERE "CNTCT_ID" = ${contactId} AND "PHONE_NBR_ID" = ${numberId} AND COALESCE("IS_DELETED", 0) = 0 ORDER BY "CNTCT_PHONE_ID" LIMIT 1`))?.id;
  if (!linkId) {
    await assertInsertSafe('contact_phones', 'CNTCT_PHONE_ID');
    [{ id: linkId }] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO contact_phones ("CNTCT_ID", "PHONE_NBR_ID", "OA_ID_ORIGINATED", "OA_BRAND_ID", "USER_ID", "IS_PRIMARY", "CREATED_BY", "CREATED_ON", "UPDATED_ON")
      VALUES (${contactId}, ${numberId}, ${o.oaId}, ${o.oaBrandId}, ${o.userId}, false, ${o.actorId}, now(), now())
      RETURNING "CNTCT_PHONE_ID" AS id`;
  }
  return linkId;
}

export interface OrgPhone {
  orgContactId: number;
  /** contact_phones id (stored as text in CNTCT_PHONE_ID). */
  linkId: number;
  phone: string;
  countryCode: string;
  phoneType: string | null;
  primary: '0' | '1';
  /** 1 for the employee's own phones (listed on Employee Phone), 0 for a relative's. */
  isEmp: 0 | 1;
  empId: number | null;
  recordId?: number;
}

/** The oa_contact_phones row of a linked number: the edited one, the brand's row of that link, or a new one; returns its id. */
export async function writeOrgPhone(
  tx: Tx, o: Pick<ContactOwner, 'oaId' | 'oaBrandId' | 'actorId'> & { userId: number | null }, p: OrgPhone,
): Promise<number> {
  const existing = p.recordId
    ? { id: p.recordId }
    : await first(tx.$queryRaw<Array<{ id: number }>>`
        SELECT "OA_CNTCT_PHONE_ID" AS id FROM oa_contact_phones
        WHERE "CNTCT_PHONE_ID" = ${String(p.linkId)} AND "OA_BRAND_ID" = ${o.oaBrandId} ORDER BY "OA_CNTCT_PHONE_ID" LIMIT 1`);
  if (existing) {
    await tx.$executeRaw`
      UPDATE oa_contact_phones SET "OA_CNTCT_ID" = ${p.orgContactId}, "CNTCT_PHONE_ID" = ${String(p.linkId)}, "COUNTRY_CODE" = ${p.countryCode || null},
        "EMP_PHONE" = ${p.phone}, "EMP_ID" = ${p.empId}, "PHONE_TYPE" = ${p.phoneType}, "IS_PRIMARY" = ${p.primary}, "IS_EMP" = ${p.isEmp},
        "IS_DELETED" = 0, "OA_ID" = ${o.oaId}, "OA_BRAND_ID" = ${o.oaBrandId}, "USER_ID" = ${o.userId}, "UPDATED_BY" = ${o.actorId}, "UPDATED_ON" = now()
      WHERE "OA_CNTCT_PHONE_ID" = ${existing.id}`;
    return existing.id;
  }
  await assertInsertSafe('oa_contact_phones', 'OA_CNTCT_PHONE_ID');
  const [row] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO oa_contact_phones ("OA_CNTCT_ID", "CNTCT_PHONE_ID", "COUNTRY_CODE", "EMP_PHONE", "PHONE_TYPE", "OA_ID", "OA_BRAND_ID",
                                   "IS_PRIMARY", "IS_EMP", "EMP_ID", "USER_ID", "CREATED_BY", "CREATED_ON", "UPDATED_ON")
    VALUES (${p.orgContactId}, ${String(p.linkId)}, ${p.countryCode || null}, ${p.phone}, ${p.phoneType}, ${o.oaId}, ${o.oaBrandId},
            ${p.primary}, ${p.isEmp}, ${p.empId}, ${o.userId}, ${o.actorId}, now(), now())
    RETURNING "OA_CNTCT_PHONE_ID" AS id`;
  return row.id;
}
