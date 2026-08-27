// app/lib/import-export/importUtils.ts
import * as XLSX from "xlsx";

export interface FieldMapping {
  key: string;   // The key in the target database record, e.g., "BANK_NAME"
  label: string; // The display name or friendly label, e.g., "Bank Name"
}

/**
 * Parses an uploaded CSV or Excel file and returns an array of records mapped to expected keys
 */
export function parseImportFile(
  file: File,
  expectedFields: FieldMapping[]
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        if (!fileData) {
          throw new Error("Could not read file content.");
        }

        let workbook: XLSX.WorkBook;
        if (isExcel) {
          workbook = XLSX.read(fileData, { type: "binary" });
        } else {
          // Read CSV as string
          workbook = XLSX.read(fileData, { type: "string" });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet to 2D array of cells (rows of arrays)
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rawRows.length === 0) {
          resolve([]);
          return;
        }

        // The first row is the header row
        const headers = (rawRows[0] as any[]).map(h => 
          h !== null && h !== undefined ? String(h).trim().toLowerCase() : ""
        );
        
        const dataRows = rawRows.slice(1);

        // Map data rows to JSON objects using field configurations
        const parsedRecords = dataRows.map((row) => {
          const record: any = {};
          
          expectedFields.forEach(({ key, label }) => {
            const keyLower = key.toLowerCase();
            const labelLower = label.toLowerCase();

            // Try to match column header by either database key or display label
            let colIndex = headers.findIndex(h => h === labelLower || h === keyLower);
            
            // Fallback: Check if headers contain clean versions (replacing underscores or spaces)
            if (colIndex === -1) {
              const cleanLabel = labelLower.replace(/[^a-z0-9]/g, "");
              const cleanKey = keyLower.replace(/[^a-z0-9]/g, "");
              colIndex = headers.findIndex(h => {
                const cleanH = h.replace(/[^a-z0-9]/g, "");
                return cleanH === cleanLabel || cleanH === cleanKey;
              });
            }

            if (colIndex !== -1 && colIndex < row.length) {
              const val = row[colIndex];
              // Normalize empty string cells or undefined cells to null
              record[key] = val !== undefined && val !== "" ? val : null;
            } else {
              record[key] = null;
            }
          });

          return record;
        });

        // Filter out completely empty rows
        const nonEmptyRecords = parsedRecords.filter(record => 
          Object.values(record).some(val => val !== null && val !== "")
        );

        resolve(nonEmptyRecords);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    if (isExcel) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  });
}
