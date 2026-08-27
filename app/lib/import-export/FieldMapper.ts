// app/lib/import-export/FieldMapper.ts
import { ImportExportField } from "./ModuleConfig";

export class FieldMapper {
  /**
   * Normalizes a string by lowercasing and stripping special characters (spaces, dashes, underscores)
   */
  public static normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /**
   * Maps raw data rows (where keys might be friendly headers or mixed case DB keys)
   * to clean objects with schema keys.
   */
  public static mapFields(rawRows: any[], fields: ImportExportField[]): any[] {
    const fieldMapping = new Map<string, string>(); // Normalized key -> DB key
    const labelMapping = new Map<string, string>(); // Normalized label -> DB key

    fields.forEach((field) => {
      fieldMapping.set(this.normalize(field.key), field.key);
      fieldMapping.set(this.normalize(field.label), field.key);
      labelMapping.set(this.normalize(field.label), field.key);
    });

    return rawRows.map((row) => {
      const mappedRow: Record<string, any> = {};

      // Initialize all configured fields to null
      fields.forEach((f) => {
        mappedRow[f.key] = null;
      });

      // Map raw values based on normalized key/header matching
      Object.keys(row).forEach((rawKey) => {
        const normalizedRawKey = this.normalize(rawKey);
        const dbKey = fieldMapping.get(normalizedRawKey);

        if (dbKey) {
          const val = row[rawKey];
          // Treat empty strings as null
          mappedRow[dbKey] = val !== undefined && val !== "" ? val : null;
        }
      });

      return mappedRow;
    });
  }
}
