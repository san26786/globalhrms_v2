/**
 * Investment Declaration page — client-safe shapes shared by lib/payroll/declarations (server) and
 * app/(dashboard)/employeeMngt/emp_investments/declarations.
 */

/** The sections with a form, by their EMPIAP master code. */
export const SECTION_CODES = ['IPCCD', 'IPCTN', 'IPME', 'DDTYPE', 'SEC80', 'IPEE', 'IPIITS', 'IPOAH', 'IPRE'] as const;
export type SectionCode = (typeof SECTION_CODES)[number];
export const isSectionCode = (v: string): v is SectionCode => (SECTION_CODES as readonly string[]).includes(v);

export interface Choice {
  value: number;
  label: string;
}

export interface MedicalRow {
  id: number;
  dependent: string;
  type: string;
  age: string;
  amount: string;
  benefit: string;
  attachment: string | null;
}

export interface DeclarationOptions {
  payment: Choice[];
  medicalType: Choice[];
  age: Choice[];
  dependentType: Choice[];
  disabilityType: Choice[];
  completionStatus: Choice[];
  cityType: Choice[];
  years: Choice[];
}

export interface DeclarationPage {
  header: {
    id: number;
    employee: { id: number; code: string | null; name: string };
    fy: { id: number; name: string | null };
    totals: { investment: string; benefit: string };
  };
  canEdit: boolean;
  summary: {
    ctc: string | null;
    professionalTax: number | null;
    standardDeduction: number | null;
    taxableIncome: number | null;
    taxPayable: number | null;
    regime: 'old' | 'new' | null;
    note: string | null;
  };
  /** Every EMPIAP section master, in CI's order; `form`: the page can declare it. */
  sections: Array<{ code: string; name: string; description: string; maxBenefit: string | null; amount: string; form: boolean }>;
  options: DeclarationOptions & { dependents: Choice[] };
  data: {
    IPCCD: { payment: string; amount: string; attachment: string | null };
    IPCTN: { amount: string; attachment: string | null };
    IPME: { rows: MedicalRow[]; dependentColumn: boolean };
    DDTYPE: { type: string; amount: string; attachment: string | null };
    SEC80: { type: string; benefit: string; attachment: string | null };
    IPEE: { interest: string; year: string };
    IPIITS: { total: string; groups: Array<{ id: number; name: string; items: Array<{ id: number; code: string; name: string; amount: string }> }> };
    IPOAH: { selfOccupied: boolean; inSameCouncil: boolean; completionStatus: string; interest: string };
    IPRE: { cityType: string; rent: string };
  };
  notices: string[];
  storageConfigured: boolean;
}

export interface SaveResult {
  message: string;
  totals: { investment: string; benefit: string };
  warnings: string[];
}
