// app/lib/import-export/ModuleConfig.ts

export interface ImportExportField {
  key: string;              // DB column name
  label: string;            // CSV/Excel column header label
  type: "string" | "number" | "boolean" | "date";
  required?: boolean;
  unique?: boolean;         // Checks database constraints for duplicate
  lookup?: {
    table: string;          // e.g. "independent_mst", "emp_mst"
    key: string;            // target lookup key, e.g. "MSTR_ID", "EMP_ID"
    matchField: string;     // match label, e.g. "MSTR_NM", "EMP_NAME"
    typeCode?: string;      // Optional type code for independent_mst lookup (e.g. "SEBN", "GNDR")
  };
}

export interface ModuleConfig {
  entity: string;           // registry key (e.g. "employee")
  table: string;            // Prisma model name (must match prisma[table])
  primaryKey: string;       // PK column name
  fields: ImportExportField[];
  importPolicy?: "insert" | "update" | "upsert"; // default is upsert
  defaults?: Record<string, any> | ((prisma: any) => Promise<Record<string, any>>);
}

export const moduleRegistry: Record<string, ModuleConfig> = {
  "bank-name-master": {
    entity: "bank-name-master",
    table: "independent_mst",
    primaryKey: "MSTR_ID",
    importPolicy: "upsert",
    defaults: async (prisma) => {
      const sebnType = await prisma.common_type.findFirst({
        where: { TYP_CD: "SEBN" },
      });
      if (!sebnType) throw new Error("SEBN type code not found in common_type");
      return {
        TYP_ID: sebnType.TYP_ID,
        IS_DELETED: false
      };
    },
    fields: [
      { key: "MSTR_CD", label: "Bank Code", type: "string", required: true, unique: true },
      { key: "MSTR_NM", label: "Bank Name", type: "string", required: true }
    ]
  },
  "bank-details": {
    entity: "bank-details",
    table: "bankdetails",
    primaryKey: "BANK_ID",
    importPolicy: "upsert",
    defaults: {
      IS_DELETED: 0
    },
    fields: [
      { key: "BANK_NAME", label: "Bank Name", type: "string", required: true },
      { key: "ACCOUNT_TYPE", label: "Account Type", type: "string", required: true },
      { key: "ACCOUNT_NO", label: "Account Number", type: "string", required: true, unique: true },
      { key: "IFSC_CODE", label: "IFSC Code", type: "string", required: true },
      { key: "BRANCH_NAME", label: "Branch Name", type: "string" },
      { key: "BANK_ADDRESS", label: "Bank Address", type: "string" },
      { key: "OPENING_BALANCE", label: "Opening Balance", type: "number" }
    ]
  },
  "bank-statement-setting": {
    entity: "bank-statement-setting",
    table: "bank_csv_settings",
    primaryKey: "ID",
    importPolicy: "upsert",
    defaults: {
      IS_DELETED: 0
    },
    fields: [
      { 
        key: "CSV_BANK", 
        label: "Bank ID", 
        type: "number", 
        required: true,
        lookup: {
          table: "independent_mst",
          key: "MSTR_ID",
          matchField: "MSTR_NM",
          typeCode: "SEBN"
        }
      },
      { key: "CSV_BANK_STATEMENT_NM", label: "CSV Column", type: "string", required: true },
      { key: "DB_BANK_STATEMENT_NM", label: "Mapped Column", type: "string", required: true },
      { key: "ANOTHER_DB_BANK_STATEMENT_NM", label: "Another Mapped Column", type: "string" },
      { key: "CRDB_FLAG", label: "CRDB Flag", type: "boolean" }
    ]
  },
  "bank-transaction": {
    entity: "bank-transaction",
    table: "banksheet",
    primaryKey: "ID",
    importPolicy: "upsert",
    defaults: {
      IS_DELETED: 0,
      TRANSACTION_STATUS: "Pending",
      TRANSACTION_STATUS_ID: 1
    },
    fields: [
      { key: "TRANSACTION_DATE", label: "Transaction Date", type: "date", required: true },
      { key: "PARTICULARS", label: "Particulars", type: "string", required: true },
      { key: "DESCRIPTION", label: "Description", type: "string" },
      { key: "CHQNO_REFNO", label: "Cheque Ref No", type: "string" },
      { key: "DEBIT_AMOUNT", label: "Debit Amount", type: "number" },
      { key: "CREDIT_AMOUNT", label: "Credit Amount", type: "number" },
      { key: "CLOSING_BAL", label: "Closing Balance", type: "number" },
      { key: "SOL", label: "SOL", type: "string" },
      { key: "ACCOUNTING_TRANSACTION_TYPE", label: "Transaction Type", type: "string" }
    ]
  },
  "employee": {
    entity: "employee",
    table: "emp_mst",
    primaryKey: "EMP_ID",
    importPolicy: "upsert",
    defaults: {
      IS_DELETED: 0,
      COUNTRY_CODE: "IN",
      EMP_OTHER_ID: "",
      OA_BRAND_ID: 1,
      JOB_TITLE_ID: 1,
      EMP_GRADE_ID: 1,
      TERMINATION_ID: 0,
      TERMINATION_DATE: new Date("1970-01-01")
    },
    fields: [
      { key: "EMP_NBR", label: "Employee Number", type: "string", required: true, unique: true },
      { key: "EMP_NAME", label: "First Name", type: "string", required: true },
      { key: "EMP_MIDDLE_NM", label: "Middle Name", type: "string" },
      { key: "EMPLST_NM", label: "Last Name", type: "string" },
      { key: "DOB", label: "Date of Birth", type: "date" },
      { key: "BLOOD_GRP", label: "Blood Group", type: "string" },
      { key: "COST_CENTER", label: "Cost Center", type: "string" },
      { key: "OA_CNTCT_EML_ID", label: "Email ID", type: "string" },
      { key: "OA_CNTCT_PHONE_ID", label: "Phone Number", type: "string" },
      { 
        key: "DEPARTMENT", 
        label: "Department", 
        type: "number",
        lookup: {
          table: "independent_mst",
          key: "MSTR_ID",
          matchField: "MSTR_NM",
          typeCode: "DEPT"
        }
      },
      { 
        key: "GENDER_ID", 
        label: "Gender", 
        type: "number",
        lookup: {
          table: "independent_mst",
          key: "MSTR_ID",
          matchField: "MSTR_NM",
          typeCode: "GNDR"
        }
      }
    ]
  },
  "common-type": {
    entity: "common-type",
    table: "common_type",
    primaryKey: "TYP_ID",
    importPolicy: "upsert",
    fields: [
      { key: "TYP_CD", label: "Type Code", type: "string", required: true, unique: true },
      { key: "TYP_NM", label: "Type Name", type: "string", required: true },
      { key: "VIEW_NM", label: "View Name", type: "string" }
    ]
  },
  "config-mapping": {
    entity: "config-mapping",
    table: "config_mapping_dtl",
    primaryKey: "CNFG_MPPNG_DTL_ID",
    importPolicy: "insert",
    // Real config_mapping_dtl columns (the previous CNFG_MPPNG_ID / CNFG_CD / … columns do not exist).
    defaults: () => Promise.resolve({ IS_DELETED: 0, UPDATED_ON: new Date() }),
    fields: [
      { key: "SRC_ENTTY_ID", label: "Source Entity ID", type: "number", required: true },
      { key: "TRGT_ENTTY_ID", label: "Target Entity ID", type: "number", required: true },
      { key: "CNFG_MPPNG_TYP_ID", label: "Mapping Type ID", type: "number" }
    ]
  }
};
