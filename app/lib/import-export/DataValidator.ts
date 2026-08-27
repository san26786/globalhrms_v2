// app/lib/import-export/DataValidator.ts
import { ImportExportField } from "./ModuleConfig";

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  validatedData: Record<string, any>;
}

export class DataValidator {
  /**
   * Pre-fetches lookup mappings to speed up validation loops.
   */
  public static async prefetchLookups(
    prisma: any,
    fields: ImportExportField[]
  ): Promise<Record<string, Map<string, number>>> {
    const lookupMaps: Record<string, Map<string, number>> = {};

    for (const field of fields) {
      if (field.lookup) {
        const { table, key, matchField, typeCode } = field.lookup;
        const nameMap = new Map<string, number>();

        if (table === "independent_mst" && typeCode) {
          // Resolve TYP_ID first
          const commonType = await prisma.common_type.findFirst({
            where: { TYP_CD: typeCode }
          });
          if (commonType) {
            const records = await prisma.independent_mst.findMany({
              where: { TYP_ID: commonType.TYP_ID },
              select: { [key]: true, [matchField]: true }
            });
            records.forEach((rec: any) => {
              if (rec[matchField] !== null && rec[matchField] !== undefined) {
                nameMap.set(String(rec[matchField]).trim().toLowerCase(), Number(rec[key]));
              }
            });
          }
        } else {
          // Standard dynamic table fetch
          const records = await prisma[table].findMany({
            select: { [key]: true, [matchField]: true }
          });
          records.forEach((rec: any) => {
            if (rec[matchField] !== null && rec[matchField] !== undefined) {
              nameMap.set(String(rec[matchField]).trim().toLowerCase(), Number(rec[key]));
            }
          });
        }

        lookupMaps[field.key] = nameMap;
      }
    }

    return lookupMaps;
  }

  /**
   * Parses and validates a single row against field specifications.
   */
  public static validateRow(
    row: Record<string, any>,
    rowIndex: number,
    fields: ImportExportField[],
    lookupMaps: Record<string, Map<string, number>>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const validatedData: Record<string, any> = {};
    let isValid = true;

    for (const field of fields) {
      const rawValue = row[field.key];
      const isNull = rawValue === null || rawValue === undefined || String(rawValue).trim() === "";

      // 1. Required Check
      if (field.required && isNull) {
        errors.push({
          row: rowIndex,
          field: field.key,
          message: `"${field.label}" is a required field and cannot be empty.`,
          severity: "error"
        });
        isValid = false;
        continue;
      }

      if (isNull) {
        validatedData[field.key] = null;
        continue;
      }

      // 2. Lookup Match Check
      if (field.lookup) {
        const lookupMap = lookupMaps[field.key];
        const valStr = String(rawValue).trim().toLowerCase();

        if (lookupMap && lookupMap.has(valStr)) {
          validatedData[field.key] = lookupMap.get(valStr);
        } else {
          // If value is numeric, check if it directly matches a key as fallback
          const rawNum = Number(rawValue);
          if (lookupMap && !isNaN(rawNum) && Array.from(lookupMap.values()).includes(rawNum)) {
            validatedData[field.key] = rawNum;
          } else {
            errors.push({
              row: rowIndex,
              field: field.key,
              message: `"${rawValue}" is not a valid choice for "${field.label}".`,
              severity: "error"
            });
            isValid = false;
          }
        }
        continue;
      }

      // 3. Type Conversion and Constraints
      if (field.type === "number") {
        const cleanNum = String(rawValue).replace(/[^0-9.-]/g, "");
        const parsedNum = parseFloat(cleanNum);
        if (isNaN(parsedNum)) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `"${rawValue}" is not a valid number.`,
            severity: "error"
          });
          isValid = false;
        } else {
          validatedData[field.key] = parsedNum;
        }
      } else if (field.type === "boolean") {
        const valStr = String(rawValue).trim().toLowerCase();
        const truthy = ["true", "yes", "y", "1", "active", "enable", "enabled"];
        validatedData[field.key] = truthy.includes(valStr);
      } else if (field.type === "date") {
        let parsedDate: Date | null = null;
        if (rawValue instanceof Date) {
          parsedDate = rawValue;
        } else {
          // Parse standard string formats
          const dateStr = String(rawValue).trim();
          // Check for Excel serial number
          const excelNum = Number(dateStr);
          if (!isNaN(excelNum) && excelNum > 25569) {
            // Excel dates start on 1900-01-01
            parsedDate = new Date((excelNum - 25569) * 86400 * 1000);
          } else {
            parsedDate = new Date(dateStr);
          }
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) {
          errors.push({
            row: rowIndex,
            field: field.key,
            message: `"${rawValue}" is not a valid date format.`,
            severity: "error"
          });
          isValid = false;
        } else {
          validatedData[field.key] = parsedDate;
        }
      } else {
        // String format
        validatedData[field.key] = String(rawValue).trim();
      }
    }

    return {
      valid: isValid,
      errors,
      validatedData
    };
  }

  /**
   * Checks database table constraints to detect already existing records.
   */
  public static async detectDbDuplicates(
    prisma: any,
    table: string,
    primaryKey: string,
    fields: ImportExportField[],
    mappedRows: Record<string, any>[]
  ): Promise<Record<string, Set<any>>> {
    const dbDuplicates: Record<string, Set<any>> = {};

    for (const field of fields) {
      if (field.unique) {
        const uniqueValues = mappedRows
          .map((r) => r[field.key])
          .filter((v) => v !== null && v !== undefined);

        if (uniqueValues.length > 0) {
          const existingRecords = await prisma[table].findMany({
            where: {
              [field.key]: { in: uniqueValues },
              ...(prisma[table].fields && "IS_DELETED" in prisma[table].fields ? { IS_DELETED: 0 } : {})
            },
            select: { [field.key]: true }
          });

          const duplicateSet = new Set(existingRecords.map((r: any) => r[field.key]));
          dbDuplicates[field.key] = duplicateSet;
        }
      }
    }

    return dbDuplicates;
  }
}
