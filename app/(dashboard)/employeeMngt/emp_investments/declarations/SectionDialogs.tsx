"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Choice, DeclarationPage, SectionCode } from "@/lib/payroll/declarations/declarationTypes";
import {
  amountText, attachmentBlob, downloadAttachment, removeMedicalCall, resetSectionCall, saveSectionCall, type FieldErrors,
} from "./declarationClient";

/**
 * CI emp_investment_declarations::get<Section> modals: one dialog per section with CI's title, heading, fields and
 * buttons — Close, Reset (CI delete<Section>: removes the section) and Save (CI update<Section>); Medical Expenses:
 * Close, Save, "Add New" (CI copyFunction) and Remove per dependent (CI medicial_delete). Pictures: gif / jpg / png
 * (1000 KB, 1024 × 768; medical 5000 KB, 2000 × 2000). Without the add / edit grant the dialogs are read-only.
 */
const NONE = "0";
const btn = "h-9 px-4";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function AmountInput({ id, value, onChange, disabled, whole }: { id: string; value: string; onChange: (v: string) => void; disabled?: boolean; whole?: boolean }) {
  return (
    <Input
      id={id}
      inputMode={whole ? "numeric" : "decimal"}
      value={value}
      disabled={disabled}
      placeholder="0"
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-gray-300 dark:border-white/15"
    />
  );
}

function ChoiceSelect({ id, value, onChange, options, disabled }: { id: string; value: string; onChange: (v: string) => void; options: Choice[]; disabled?: boolean }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className="h-9 rounded-lg border border-gray-300 px-3 dark:border-white/15">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        <SelectItem value={NONE}>Select an option</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** CI setImageControl: the current picture (shown) and a file input for a new one. */
function PictureField({
  id, investment, slot, current, onFile, disabled, error, medical, storage,
}: {
  id: string;
  investment: number;
  slot: string | null;
  current: string | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
  error?: string;
  medical?: boolean;
  storage: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!slot || !current) return;
    let url: string | null = null;
    let live = true;
    attachmentBlob(investment, slot)
      .then((f) => {
        if (!f) return;
        url = f.url;
        if (live && f.image) setPreview(f.url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [investment, slot, current]);
  return (
    <Field id={id} label="Attachment" error={error} hint={medical ? "gif, jpg or png — at most 5000 KB and 2000 × 2000 pixels." : "gif, jpg or png — at most 1000 KB and 1024 × 768 pixels."}>
      {current && slot ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#535768] dark:text-[#aab3c5]">
          {/* eslint-disable-next-line @next/next/no-img-element -- an authenticated blob URL */}
          {preview ? <img src={preview} alt="Attachment" className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-white/10" /> : null}
          <span className="break-all">{current}</span>
          <button type="button" className="text-[#0b5394] underline dark:text-[#8cb8f0]" onClick={() => downloadAttachment(investment, slot, current)}>
            Download
          </button>
        </div>
      ) : null}
      <input
        id={id}
        type="file"
        accept=".gif,.jpg,.png"
        disabled={disabled || !storage}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm dark:text-slate-300 dark:file:bg-[#111a2e]"
      />
    </Field>
  );
}

function Shell({
  open, onClose, title, heading, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  heading: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{heading}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        <DialogFooter className="gap-2 sm:gap-2">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DialogProps {
  page: DeclarationPage;
  onClose: () => void;
  /** After a save / reset: reload the page's data (`close`: the dialog closes, as CI's modal toggled). */
  onChanged: (close: boolean) => void;
}

// ------------------------------------------------------------------ single-row sections

type FieldKind = "amount" | "whole" | "choice" | "check";
type OptionKey = keyof DeclarationPage["options"];
interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: OptionKey;
}
type SimpleCode = Exclude<SectionCode, "IPME" | "IPIITS">;

const SIMPLE: Record<SimpleCode, { title: string; heading: string; slot?: string; fields: FieldDef[] }> = {
  IPCCD: {
    title: "Charitable Contributions & Donations",
    heading: "Section 80G - Charitable Contributions & Donations",
    slot: "don",
    fields: [
      { name: "payment", label: "Payment Mode", kind: "choice", options: "payment" },
      { name: "amount", label: "Employee 80G Investment", kind: "whole" },
    ],
  },
  IPCTN: {
    title: "Contribution to NPS",
    heading: "Section 80CCD(1B) - Contribution to NPS",
    slot: "nps",
    fields: [{ name: "amount", label: "Employee 80CCD(1B) Investment", kind: "whole" }],
  },
  DDTYPE: {
    title: "Sec 80DD Benefits - Dependent & Disability",
    heading: "Sec 80DD Benefits - Dependent & Disability",
    slot: "dd",
    fields: [
      { name: "type", label: "Dependent Type", kind: "choice", options: "dependentType" },
      { name: "amount", label: "Employee 80DD Investment", kind: "whole" },
    ],
  },
  SEC80: {
    title: "Section 80U - Disable Employee",
    heading: "Section 80U - Disable Employee",
    slot: "dis",
    fields: [{ name: "type", label: "Disability Type", kind: "choice", options: "disabilityType" }],
  },
  IPEE: {
    title: "Section 80E - Education Expenses",
    heading: "Section 80E - Education Expenses",
    fields: [
      { name: "interest", label: "Interest paid for Educational Loan taken from Financial institution / Charitable trust", kind: "amount" },
      { name: "year", label: "In which year (1st April to 31st March) Interest was first paid", kind: "choice", options: "years" },
    ],
  },
  IPOAH: {
    title: "Section 24b - Owning a House, Flat, Apartment, Commercial Premises",
    heading: "Section 24b - Owning a House, Flat, Apartment, Commercial Premises",
    fields: [
      { name: "selfOccupied", label: "Self Occupied", kind: "check" },
      { name: "inSameCouncil", label: "In Same Council", kind: "check" },
      { name: "completionStatus", label: "Completion Status", kind: "choice", options: "completionStatus" },
      { name: "interest", label: "Interest paid for Home Loan", kind: "amount" },
    ],
  },
  IPRE: {
    title: "Section 10(13A) - Rent Expenditure",
    heading: "Section 10(13A) - Rent Expenditure",
    fields: [
      { name: "cityType", label: "City Type", kind: "choice", options: "cityType" },
      { name: "rent", label: "Rent paid per annum", kind: "amount" },
    ],
  },
};

export const isSimpleCode = (code: string): code is SimpleCode => Object.prototype.hasOwnProperty.call(SIMPLE, code);

export function SimpleSectionDialog({ code, page, onClose, onChanged }: DialogProps & { code: SimpleCode }) {
  const def = SIMPLE[code];
  const stored = page.data[code] as Record<string, string | boolean | null>;
  const initial = useMemo(() => {
    const v: Record<string, string | boolean> = {};
    for (const f of def.fields) v[f.name] = f.kind === "check" ? stored[f.name] === true : String(stored[f.name] ?? "");
    return v;
  }, [def, stored]);
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const readOnly = !page.canEdit;
  const set = (name: string, v: string | boolean) => setValues((s) => ({ ...s, [name]: v }));

  const save = async () => {
    const body = new FormData();
    for (const f of def.fields) body.append(f.name, f.kind === "check" ? (values[f.name] ? "1" : "0") : String(values[f.name] ?? ""));
    if (file) body.append("file", file);
    setBusy("save");
    const r = await saveSectionCall(page.header.id, code, body);
    setBusy(null);
    if (r.ok) onChanged(true);
    else setErrors(r.errors);
  };
  const reset = async () => {
    if (!window.confirm("Reset this section? Its declaration is removed.")) return;
    setBusy("reset");
    const r = await resetSectionCall(page.header.id, code);
    setBusy(null);
    if (r.ok) onChanged(true);
  };

  return (
    <Shell
      open
      onClose={onClose}
      title={def.title}
      heading={def.heading}
      footer={
        <>
          <Button variant="outline" className={btn} onClick={onClose} disabled={!!busy}>
            Close
          </Button>
          {!readOnly ? (
            <Button variant="destructive" className={btn} onClick={reset} disabled={!!busy}>
              {busy === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset
            </Button>
          ) : null}
          {!readOnly ? (
            <Button className={btn} onClick={save} disabled={!!busy}>
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          ) : null}
        </>
      }
    >
      {def.fields.map((f) => {
        const id = `${code}-${f.name}`;
        if (f.kind === "check") {
          return (
            <div key={f.name} className="flex items-center gap-2">
              <Checkbox id={id} checked={values[f.name] === true} disabled={readOnly} onCheckedChange={(v) => set(f.name, v === true)} />
              <Label htmlFor={id} className="text-sm text-slate-700 dark:text-[#d5dae4]">
                {f.label}
              </Label>
            </div>
          );
        }
        return (
          <Field key={f.name} id={id} label={f.label} error={errors[f.name]}>
            {f.kind === "choice" ? (
              <ChoiceSelect id={id} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} options={page.options[f.options!]} disabled={readOnly} />
            ) : (
              <AmountInput id={id} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} disabled={readOnly} whole={f.kind === "whole"} />
            )}
          </Field>
        );
      })}
      {code === "SEC80" ? <p className="text-sm text-slate-600 dark:text-[#c3cad6]">Benefit: {amountText(page.data.SEC80.benefit)}</p> : null}
      {def.slot ? (
        <PictureField
          id={`${code}-file`}
          investment={page.header.id}
          slot={def.slot}
          current={(stored.attachment as string | null) ?? null}
          onFile={setFile}
          disabled={readOnly}
          error={errors.file}
          storage={page.storageConfigured}
        />
      ) : null}
    </Shell>
  );
}

// ------------------------------------------------------------------ 80C

/** CI getTaxSavingsInstruments: the 80C groups (collapsed, opened by their header) with one amount per sub-section. */
export function TaxSavingsDialog({ page, onClose, onChanged }: DialogProps) {
  const groups = page.data.IPIITS.groups;
  const [values, setValues] = useState<Record<number, string>>(() => {
    const v: Record<number, string> = {};
    for (const g of groups) for (const i of g.items) v[i.id] = i.amount === "0" ? "" : i.amount;
    return v;
  });
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const readOnly = !page.canEdit;
  const total = Object.values(values).reduce((s, v) => s + (Number(v.replace(/,/g, "")) || 0), 0);

  const save = async () => {
    const body = new FormData();
    body.append("amounts", JSON.stringify(values));
    setBusy("save");
    const r = await saveSectionCall(page.header.id, "IPIITS", body);
    setBusy(null);
    if (r.ok) onChanged(true);
    else {
      setErrors(r.errors);
      // Open the groups holding an error.
      setOpenGroups(new Set(groups.filter((g) => g.items.some((i) => r.errors[`sub_${i.id}`])).map((g) => g.id)));
    }
  };
  const reset = async () => {
    if (!window.confirm("Reset this section? Its declaration is removed.")) return;
    setBusy("reset");
    const r = await resetSectionCall(page.header.id, "IPIITS");
    setBusy(null);
    if (r.ok) onChanged(true);
  };
  const toggle = (id: number) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Shell
      open
      onClose={onClose}
      title="Section 80C - Investments in Tax-Saving Instruments"
      heading="Section 80C - Investments in Tax-Saving Instruments"
      footer={
        <>
          <Button variant="outline" className={btn} onClick={onClose} disabled={!!busy}>
            Close
          </Button>
          {!readOnly ? (
            <Button variant="destructive" className={btn} onClick={reset} disabled={!!busy}>
              {busy === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset
            </Button>
          ) : null}
          {!readOnly ? (
            <Button className={btn} onClick={save} disabled={!!busy}>
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          ) : null}
        </>
      }
    >
      {groups.map((g) => (
        <div key={g.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => toggle(g.id)}
            className="flex w-full items-center gap-2 bg-[#525564] px-3 py-2 text-left text-sm font-medium text-white"
          >
            {openGroups.has(g.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {g.name}
          </button>
          {openGroups.has(g.id) ? (
            <div className="space-y-3 bg-slate-50 p-3 dark:bg-white/5">
              {g.items.length ? null : <p className="text-sm text-slate-500">No sub-sections.</p>}
              {g.items.map((i) => (
                <Field key={i.id} id={`sub-${i.id}`} label={i.name} error={errors[`sub_${i.id}`]}>
                  <AmountInput id={`sub-${i.id}`} value={values[i.id] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [i.id]: v }))} disabled={readOnly} />
                </Field>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      {errors.amounts ? <p className="text-xs text-red-600">{errors.amounts}</p> : null}
      <p className="text-sm font-medium text-slate-700 dark:text-[#d5dae4]">Total declared: {amountText(total)}</p>
    </Shell>
  );
}

// ------------------------------------------------------------------ Medical Expenses

interface MedicalDraft {
  key: string;
  id: number | null;
  dependent: string;
  type: string;
  age: string;
  amount: string;
  attachment: string | null;
  file: File | null;
}

let draftKey = 0;
const emptyRow = (): MedicalDraft => ({ key: `new-${++draftKey}`, id: null, dependent: "", type: "", age: "", amount: "", attachment: null, file: null });

/** CI getmedicial: one "Dependent Detail" block per dependent. */
export function MedicalDialog({ page, onClose, onChanged }: DialogProps) {
  const toDrafts = (p: DeclarationPage) =>
    p.data.IPME.rows.length
      ? p.data.IPME.rows.map((r) => ({ key: `row-${r.id}`, id: r.id, dependent: r.dependent, type: r.type, age: r.age, amount: r.amount, attachment: r.attachment, file: null }))
      : [emptyRow()];
  const [rows, setRows] = useState<MedicalDraft[]>(() => toDrafts(page));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const readOnly = !page.canEdit;
  const withName = page.data.IPME.dependentColumn;
  const set = (key: string, patch: Partial<MedicalDraft>) => setRows((s) => s.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    const body = new FormData();
    body.append("rows", JSON.stringify(rows.map((r) => ({ id: r.id, dependent: r.dependent, type: r.type, age: r.age, amount: r.amount }))));
    rows.forEach((r, i) => r.file && body.append(`file_${i}`, r.file));
    setBusy(true);
    const r = await saveSectionCall(page.header.id, "IPME", body);
    setBusy(false);
    if (r.ok) onChanged(true);
    else setErrors(r.errors);
  };
  /** CI Remove: a saved dependent is deleted at once (medicial_delete); an unsaved one leaves the form. */
  const remove = async (row: MedicalDraft) => {
    if (!row.id) {
      setRows((s) => (s.length > 1 ? s.filter((r) => r.key !== row.key) : [emptyRow()]));
      return;
    }
    if (!window.confirm("Remove this dependent's medical expense?")) return;
    setBusy(true);
    const r = await removeMedicalCall(page.header.id, row.id);
    setBusy(false);
    if (r.ok) {
      setRows((s) => (s.length > 1 ? s.filter((x) => x.key !== row.key) : [emptyRow()]));
      onChanged(false);
    }
  };

  return (
    <Shell
      open
      onClose={onClose}
      title="Medical Expenses"
      heading="Sec 80D - Medical insurance premium and expenses, per dependent"
      footer={
        <>
          <Button variant="outline" className={btn} onClick={onClose} disabled={busy}>
            Close
          </Button>
          {!readOnly ? (
            <Button className={btn} onClick={save} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          ) : null}
          {!readOnly ? (
            <Button variant="outline" className={btn} onClick={() => setRows((s) => [...s, emptyRow()])} disabled={busy || rows.length >= 20}>
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          ) : null}
        </>
      }
    >
      {rows.map((r, i) => (
        <div key={r.key} className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-[#d5dae4]">Dependent Detail {i + 1}</span>
            {!readOnly ? (
              <Button variant="outline" className="h-8 px-3" onClick={() => remove(r)} disabled={busy}>
                <X className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
          {errors[`rows.${i}`] ? <p className="text-xs text-red-600">{errors[`rows.${i}`]}</p> : null}
          {withName ? (
            <Field id={`med-${r.key}-dep`} label="Dependent Name" error={errors[`rows.${i}.dependent`]}>
              <ChoiceSelect id={`med-${r.key}-dep`} value={r.dependent} onChange={(v) => set(r.key, { dependent: v })} options={page.options.dependents} disabled={readOnly} />
            </Field>
          ) : null}
          <Field id={`med-${r.key}-type`} label="Dependent Type" error={errors[`rows.${i}.type`]}>
            <ChoiceSelect id={`med-${r.key}-type`} value={r.type} onChange={(v) => set(r.key, { type: v })} options={page.options.medicalType} disabled={readOnly} />
          </Field>
          <Field id={`med-${r.key}-age`} label="Age" error={errors[`rows.${i}.age`]}>
            <ChoiceSelect id={`med-${r.key}-age`} value={r.age} onChange={(v) => set(r.key, { age: v })} options={page.options.age} disabled={readOnly} />
          </Field>
          <Field id={`med-${r.key}-amount`} label="Employee 80D Investment" error={errors[`rows.${i}.amount`]}>
            <AmountInput id={`med-${r.key}-amount`} value={r.amount} onChange={(v) => set(r.key, { amount: v })} disabled={readOnly} whole />
          </Field>
          <PictureField
            id={`med-${r.key}-file`}
            investment={page.header.id}
            slot={r.id ? `med${r.id}` : null}
            current={r.attachment}
            onFile={(f) => set(r.key, { file: f })}
            disabled={readOnly}
            error={errors[`rows.${i}.file`]}
            medical
            storage={page.storageConfigured}
          />
        </div>
      ))}
      {errors.rows ? <p className="text-xs text-red-600">{errors.rows}</p> : null}
    </Shell>
  );
}
