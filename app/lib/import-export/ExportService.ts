// app/lib/import-export/ExportService.ts
import { moduleRegistry } from "./ModuleConfig";
import { 
  exportToCSV, 
  exportToExcel, 
  exportToPDF, 
  printData, 
  copyToClipboard 
} from "./exportUtils";

export interface ColumnSetting {
  systemName: string;
  displayName: string;
  visibleInList: boolean;
  visibleInForm: boolean;
}

export class ExportService {
  /**
   * Automatically exports the given dataset into the specified format,
   * matching the visible table columns, filtering sensitive columns,
   * and fetching headers/keys dynamically.
   */
  public static export(
    entity: string,
    format: string,
    data: any[],
    columnSettings: ColumnSetting[],
    title: string,
    filename: string
  ): void {
    const config = moduleRegistry[entity];
    const sensitiveKeys = new Set([
      "password", "passwd", "pass", "pwd",
      "auth_token", "token", "secret", "security_key",
      "session_id", "credit_card", "pin"
    ]);

    // 1. Filter out sensitive keys first
    const safeColumnSettings = columnSettings.filter(
      (col) => !sensitiveKeys.has(col.systemName.toLowerCase())
    );

    // 2. Derive visible headers and database column mapping keys
    const visibleColumns = safeColumnSettings.filter((c) => c.visibleInList);
    const headers = visibleColumns.map((c) => c.displayName);
    const keys = visibleColumns.map((c) => c.systemName);

    const dateStr = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${dateStr}`;

    switch (format.toUpperCase()) {
      case "CSV":
        exportToCSV(headers, keys, data, finalFilename);
        break;
      case "EXCEL":
        exportToExcel(headers, keys, data, finalFilename);
        break;
      case "PDF":
        exportToPDF(title, headers, keys, data, finalFilename);
        break;
      case "PRINT":
        printData(title, headers, keys, data);
        break;
      case "COPY":
        copyToClipboard(headers, keys, data);
        break;
      default:
        console.error(`Unsupported export format: ${format}`);
    }
  }
}
