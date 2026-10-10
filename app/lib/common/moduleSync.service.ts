import { prisma } from '@/lib/prisma';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { assertInsertSafe } from '@/lib/db/sequenceGuard';
import { ForbiddenError } from '@/lib/http/errors';
import { menuPolicy, adminOnly } from '@/lib/resource/policies';
import { resolveBrand } from '@/lib/utilities/access';
import { moduleSyncSchema, type ModuleSyncTable } from '@/validations/common.schema';

/**
 * Sync Employee Details — CI controllers/common/modulesync.php + models/common/modulesync_m.php.
 *
 * CI syncEmployeesNew($table, $brand) ran one MySQL
 *   INSERT INTO {table}(REF_EMP_ID, REF_EMP_CD, EMP_NM, MANAGER_ID, IS_MANAGER, OA_ID, OA_BRAND_ID)
 *   SELECT … FROM emp_mst WHERE OA_BRAND_ID = {brand}
 *   ON DUPLICATE KEY UPDATE EMP_NM, REF_EMP_CD, IS_MANAGER, MANAGER_ID
 * i.e. every employee of the brand is upserted into the module's employee table, the name being
 * "first middle last" and MANAGER_ID the module-table id of the employee's manager.
 * The migrated PostgreSQL tables have no unique key, so the upsert is done as update-existing
 * (matched by REF_EMP_ID + OA_BRAND_ID) → insert-missing → resolve managers, in one transaction.
 *
 * Brand: CI showed the organisation/brand selectors to the sysadmin only; everyone else syncs the
 * active brand. Access: the "Sync Employee Details" menu (common/modulesync), admins by default.
 */

export const MODULE_SYNC_MODULES: Record<ModuleSyncTable, { label: string; pk: string }> = {
  achievment_employee: { label: 'Achievement Employee', pk: 'ACH_EMP_ID' },
  attendance_employee: { label: 'Attendance Employee', pk: 'ATTND_EMP_ID' },
  kns_employee: { label: 'KNS Employee', pk: 'EMP_ID' },
  leave_employee: { label: 'Leave Employee', pk: 'LEAVE_EMP_ID' },
  outdrentr_employee: { label: 'Outdoor Entry Employee', pk: 'OD_EMP_ID' },
  pi_employee: { label: 'Performance Employee', pk: 'PI_EMP_ID' },
  timesheet_employee: { label: 'Timesheet Employee', pk: 'TS_EMP_ID' },
  mileage_employee: { label: 'Mileage Employee', pk: 'MIL_EMP_ID' },
  checklist_employee: { label: 'Checklist Employee', pk: 'CK_EMP_ID' },
  loan_employee: { label: 'Loan Employee', pk: 'LOAN_EMP_ID' },
  asset_employee: { label: 'Asset Employee', pk: 'ASSET_EMP_ID' },
  expenses_employee: { label: 'Expenses Employee', pk: 'EXP_EMP_ID' },
};

const policy = menuPolicy('common/modulesync', adminOnly);

export interface ModuleSyncResult {
  module: ModuleSyncTable;
  moduleLabel: string;
  brand: { oaBrandId: number; name: string };
  updated: number;
  inserted: number;
  managersLinked: number;
  message: string;
}

const EMP_NAME_SQL = `TRIM(CONCAT(COALESCE(e."EMP_NAME", ''), ' ', COALESCE(e."EMP_MIDDLE_NM", ''), ' ', COALESCE(e."EMPLST_NM", '')))`;

class ModuleSyncService {
  async authorize(subject: RequestSubject) {
    if (!(await policy.check(subject, 'list'))) throw new ForbiddenError();
  }

  async modules(subject: RequestSubject) {
    await this.authorize(subject);
    return {
      modules: Object.entries(MODULE_SYNC_MODULES).map(([value, m]) => ({ value, label: m.label })),
      canChooseBrand: subject.adminLevel === 2,
    };
  }

  async sync(subject: RequestSubject, body: unknown): Promise<ModuleSyncResult> {
    await this.authorize(subject);
    const input = moduleSyncSchema.parse(body);
    const brand = await resolveBrand(subject, subject.adminLevel === 2 ? (input.oaBrandId ?? null) : null);
    const table = input.module;
    const { pk, label } = MODULE_SYNC_MODULES[table];
    // Identifiers come from the fixed whitelist above, never from the request.
    const t = `"${table}"`;
    const k = `"${pk}"`;

    await assertInsertSafe(table, pk);

    const [updated, inserted, managersLinked] = await prisma.$transaction(async (tx) => {
      const updatedRows = await tx.$executeRawUnsafe(
        `UPDATE ${t} m
            SET "EMP_NM" = ${EMP_NAME_SQL}, "REF_EMP_CD" = e."EMP_NBR", "IS_MANAGER" = e."IS_MANAGER"
           FROM emp_mst e
          WHERE e."OA_BRAND_ID" = $1 AND m."OA_BRAND_ID" = $1 AND m."REF_EMP_ID" = e."REF_EMP_ID"`,
        brand.oaBrandId,
      );
      const insertedRows = await tx.$executeRawUnsafe(
        `INSERT INTO ${t} ("REF_EMP_ID", "REF_EMP_CD", "EMP_NM", "IS_MANAGER", "OA_ID", "OA_BRAND_ID", "IS_DELETED")
         SELECT DISTINCT ON (e."REF_EMP_ID") e."REF_EMP_ID", e."EMP_NBR", ${EMP_NAME_SQL}, e."IS_MANAGER", e."OA_ID", e."OA_BRAND_ID", 0
           FROM emp_mst e
          WHERE e."OA_BRAND_ID" = $1 AND e."REF_EMP_ID" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM ${t} x WHERE x."REF_EMP_ID" = e."REF_EMP_ID" AND x."OA_BRAND_ID" = $1)
          ORDER BY e."REF_EMP_ID", e."EMP_ID"`,
        brand.oaBrandId,
      );
      // MANAGER_ID = the module-table id of the employee's manager (CI sub-select on emp_mst.MANAGER_ID).
      const managerRows = await tx.$executeRawUnsafe(
        `UPDATE ${t} m
            SET "MANAGER_ID" = (
              SELECT ct.${k} FROM ${t} ct JOIN emp_mst em ON em."REF_EMP_ID" = ct."REF_EMP_ID"
               WHERE em."EMP_ID" = e."MANAGER_ID" AND ct."OA_BRAND_ID" = $1
               ORDER BY ct.${k} LIMIT 1)
           FROM emp_mst e
          WHERE e."OA_BRAND_ID" = $1 AND m."OA_BRAND_ID" = $1 AND m."REF_EMP_ID" = e."REF_EMP_ID"`,
        brand.oaBrandId,
      );
      return [updatedRows, insertedRows, managerRows] as const;
    });

    return {
      module: table,
      moduleLabel: label,
      brand: { oaBrandId: brand.oaBrandId, name: brand.name },
      updated,
      inserted,
      managersLinked,
      message: 'Sync Successfully',
    };
  }
}

export const moduleSyncService = new ModuleSyncService();
