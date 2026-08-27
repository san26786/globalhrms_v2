// app/lib/import-export/exportUtils.ts
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Escapes values for CSV cells
 */
const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Exports data to CSV and triggers download
 */
export function exportToCSV(headers: string[], keys: string[], data: any[], filename: string) {
  const headerLine = headers.map(escapeCSV).join(",");
  const rowLines = data.map(item =>
    keys.map(key => escapeCSV(item[key])).join(",")
  );

  const csvContent = [headerLine, ...rowLines].join("\n");
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" }); // Includes BOM for UTF-8 compatibility (especially for Excel)
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to Excel workbook (xlsx format) and triggers download
 */
export function exportToExcel(headers: string[], keys: string[], data: any[], filename: string) {
  // Format data for sheetjs to display headers as key names
  const formattedData = data.map((item) => {
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = item[keys[index]] !== null && item[keys[index]] !== undefined ? item[keys[index]] : "";
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  // Trigger file download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Exports data to a formatted landscape PDF with a title and page numbers
 */
export function exportToPDF(title: string, headers: string[], keys: string[], data: any[], filename: string) {
  const doc = new jsPDF("l", "pt", "a4"); // Landscape layout, points unit, A4 format
  
  // Format table rows
  const rows = data.map((item) => {
    return keys.map((key) => {
      const val = item[key];
      return val !== null && val !== undefined ? String(val) : "";
    });
  });

  // PDF Page Header
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(title, 40, 45);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 60);

  // Generate Table using jspdf-autotable
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 75,
    theme: "striped",
    headStyles: { 
      fillColor: [37, 99, 235], // Blue-600 theme
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 6,
      overflow: "linebreak",
    },
    columnStyles: {
      // Allow wrapping of long columns
      address: { cellWidth: "auto" }
    },
    margin: { top: 75, bottom: 40, left: 40, right: 40 },
    didDrawPage: (dataPage) => {
      // Add page numbers at the bottom of each page
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      
      const footerText = `Page ${doc.getNumberOfPages()}`;
      doc.text(footerText, pageWidth - 40 - doc.getTextWidth(footerText), pageHeight - 20);
    }
  });

  // Save the document
  doc.save(`${filename}.pdf`);
}

/**
 * Formats table data into a clean, printable HTML table and triggers native browser print
 */
export function printData(title: string, headers: string[], keys: string[], data: any[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const htmlHeaders = headers.map(h => `<th>${h}</th>`).join("");
  const htmlRows = data.map(item => {
    const cells = keys.map(key => {
      const val = item[key];
      return `<td>${val !== null && val !== undefined ? String(val) : "-"}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 24px; 
            color: #334155; 
          }
          h1 { 
            font-size: 22px; 
            margin: 0 0 8px 0; 
            color: #0f172a; 
          }
          .meta {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 24px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
          }
          th, td { 
            border: 1px solid #e2e8f0; 
            padding: 10px 12px; 
            text-align: left; 
            font-size: 11px; 
          }
          th { 
            background-color: #f8fafc; 
            font-weight: 700; 
            color: #334155; 
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) { 
            background-color: #f8fafc; 
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Printed on: ${new Date().toLocaleString()}</div>
        <table>
          <thead>
            <tr>${htmlHeaders}</tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Copies the table data formatted as tab-separated values (TSV) to clipboard
 */
export async function copyToClipboard(headers: string[], keys: string[], data: any[]): Promise<boolean> {
  const escapeCopy = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    // Remove tab characters and replace carriage returns/newlines with spaces
    return str.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  };

  const headerLine = headers.map(escapeCopy).join("\t");
  const rowLines = data.map(item =>
    keys.map(key => escapeCopy(item[key])).join("\t")
  );

  const tsvContent = [headerLine, ...rowLines].join("\n");

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsvContent);
      return true;
    }
    throw new Error("navigator.clipboard not available");
  } catch (err) {
    // Fallback using textarea
    try {
      const textArea = document.createElement("textarea");
      textArea.value = tsvContent;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error("Clipboard copy failed: ", fallbackErr);
      return false;
    }
  }
}
