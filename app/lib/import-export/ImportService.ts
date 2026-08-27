// app/lib/import-export/ImportService.ts
import { prisma } from "../prisma";
import { moduleRegistry, ModuleConfig } from "./ModuleConfig";
import { FieldMapper } from "./FieldMapper";
import { DataValidator, ValidationError } from "./DataValidator";

export interface RowPreview {
  rowNumber: number;
  status: "valid" | "error" | "warning";
  errors: string[];
  data: Record<string, any>;
}

export interface ImportPreviewResult {
  success: boolean;
  message?: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  previews: RowPreview[];
}

export interface ImportExecutionResult {
  success: boolean;
  message: string;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
}

export class ImportService {
  /**
   * Generates a structural row-by-row validation preview before database insertion.
   */
  public static async generatePreview(
    entity: string,
    rawRows: any[]
  ): Promise<ImportPreviewResult> {
    const config = moduleRegistry[entity];
    if (!config) {
      return {
        success: false,
        message: `Entity configuration for "${entity}" is not registered.`,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        previews: []
      };
    }

    // Step 1: Map fields
    const mappedRows = FieldMapper.mapFields(rawRows, config.fields);

    // Step 2: Fetch lookup tables
    const lookupMaps = await DataValidator.prefetchLookups(prisma, config.fields);

    // Step 3: Fetch duplicate unique records in database
    const dbDuplicates = await DataValidator.detectDbDuplicates(
      prisma,
      config.table,
      config.primaryKey,
      config.fields,
      mappedRows
    );

    const previews: RowPreview[] = [];
    let validRowsCount = 0;
    let invalidRowsCount = 0;

    // Step 4: Validate each row
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const rowNumber = i + 2; // 1-indexed header is row 1
      const validation = DataValidator.validateRow(row, rowNumber, config.fields, lookupMaps);

      const rowErrors: string[] = validation.errors.map((e) => e.message);
      let status: "valid" | "error" | "warning" = validation.valid ? "valid" : "error";

      // Unique / Duplicate database check
      if (status === "valid") {
        for (const field of config.fields) {
          if (field.unique && dbDuplicates[field.key]?.has(row[field.key])) {
            if (config.importPolicy === "insert") {
              rowErrors.push(
                `Duplicate Error: Record with ${field.label} "${row[field.key]}" already exists in database.`
              );
              status = "error";
            } else if (config.importPolicy === "upsert" || config.importPolicy === "update") {
              // Mark as warning/update indicator
              status = "warning";
            }
          }
        }
      }

      if (status === "error") {
        invalidRowsCount++;
      } else {
        validRowsCount++;
      }

      previews.push({
        rowNumber,
        status,
        errors: rowErrors,
        data: row
      });
    }

    return {
      success: true,
      totalRows: rawRows.length,
      validRowsCount,
      invalidRowsCount,
      previews
    };
  }

  /**
   * Executes bulk database inserts/updates transactionally.
   */
  public static async executeImport(
    entity: string,
    rows: any[]
  ): Promise<ImportExecutionResult> {
    const config = moduleRegistry[entity];
    if (!config) {
      throw new Error(`Entity "${entity}" is not registered.`);
    }

    const prismaDelegate = (prisma as any)[config.table];
    if (!prismaDelegate) {
      throw new Error(`Prisma delegate for "${config.table}" not found.`);
    }

    // Load defaults
    let defaultValues: Record<string, any> = {};
    if (typeof config.defaults === "function") {
      defaultValues = await config.defaults(prisma);
    } else if (config.defaults) {
      defaultValues = config.defaults;
    }

    // Step 2: Fetch lookup tables & map fields again to be database ready
    const lookupMaps = await DataValidator.prefetchLookups(prisma, config.fields);
    const mappedRows = FieldMapper.mapFields(rows, config.fields);

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    // Use Prisma transaction to guarantee database consistency
    await prisma.$transaction(async (tx: any) => {
      const txDelegate = tx[config.table];

      for (const row of mappedRows) {
        // Run validation to convert inputs to correct types
        const validation = DataValidator.validateRow(row, 0, config.fields, lookupMaps);
        if (!validation.valid) {
          failed++;
          continue;
        }

        const dataPayload = {
          ...defaultValues,
          ...validation.validatedData
        };

        // Determine if updating or inserting
        let existingRecord = null;

        // Try to locate by unique fields or primary key
        for (const field of config.fields) {
          if (field.unique && dataPayload[field.key]) {
            existingRecord = await txDelegate.findFirst({
              where: {
                [field.key]: dataPayload[field.key],
                ...(txDelegate.fields && "IS_DELETED" in txDelegate.fields ? { IS_DELETED: 0 } : {})
              }
            });
            if (existingRecord) break;
          }
        }

        if (existingRecord) {
          if (config.importPolicy === "insert") {
            throw new Error(
              `Constraint conflict: Record with unique field already exists.`
            );
          }

          // Perform Update
          await txDelegate.update({
            where: { [config.primaryKey]: existingRecord[config.primaryKey] },
            data: dataPayload
          });
          updated++;
        } else {
          if (config.importPolicy === "update") {
            // Skip update if not found in db
            failed++;
            continue;
          }

          // Perform Insert
          await txDelegate.create({
            data: dataPayload
          });
          inserted++;
        }
      }
    });

    return {
      success: true,
      message: `Import completed. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`,
      total: rows.length,
      inserted,
      updated,
      failed
    };
  }
}
