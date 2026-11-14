'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import EntityDialog from '@/components/Dialog/EntityDialog';
import SearchableSelect from '@/components/forms/SearchableSelect';
import { Input } from '@/components/ui/input';
import type { ResolvedListAction } from '@/lib/listview/listDefinitions';

/**
 * The form of a configured `dialog` list action (CI getCustomFields modals, e.g. Auto Generate
 * Timesheet): fields come from listDefinitions; `onSubmit` sends the values and throws on failure.
 */
type Dialog = NonNullable<ResolvedListAction['dialog']>;
type Values = Record<string, string | boolean>;

const initial = (dialog: Dialog): Values =>
  Object.fromEntries(dialog.fields.map((f) => [f.name, f.type === 'checkbox' ? false : f.type === 'select' ? '0' : '']));

export default function ListActionDialog({
  dialog,
  onClose,
  onSubmit,
}: {
  dialog: Dialog;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Values>(() => initial(dialog));
  const [busy, setBusy] = useState(false);

  const set = (name: string, value: string | boolean) =>
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // A date with `minField` follows that field while empty or earlier (CI start → end date).
      for (const f of dialog.fields) {
        if (f.minField === name && typeof value === 'string' && (!next[f.name] || String(next[f.name]) < value)) next[f.name] = value;
      }
      return next;
    });

  const submit = async () => {
    for (const f of dialog.fields) {
      const v = values[f.name];
      if (f.required && (v === '' || v === '0' || v === false)) return toast.error(`${f.label} is required.`);
      if (f.minField && v && values[f.minField] && String(v) < String(values[f.minField])) {
        const min = dialog.fields.find((x) => x.name === f.minField);
        return toast.error(`${f.label} cannot be before ${min?.label ?? f.minField}.`);
      }
    }
    const body = Object.fromEntries(
      dialog.fields.map((f) => {
        const v = values[f.name];
        if (f.type === 'select') return [f.name, v === '0' ? null : Number(v)];
        if (f.type === 'date') return [f.name, v || null];
        return [f.name, v];
      }),
    );
    setBusy(true);
    try {
      await onSubmit(body);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EntityDialog open title={dialog.title} loading={busy} submitText={dialog.submitText} size="md" onClose={onClose} onSubmit={submit}>
      <div className="grid gap-4">
        {dialog.fields.map((f) =>
          f.type === 'checkbox' ? (
            <label key={f.name} className="flex items-center gap-2 text-sm text-slate-700 dark:text-[#d5dae4]">
              <input type="checkbox" checked={values[f.name] === true} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4" />
              {f.label}
            </label>
          ) : (
            <label key={f.name} className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-[#d5dae4]">
              <span>
                {f.label}
                {f.required && <span className="text-rose-500"> *</span>}
              </span>
              {f.type === 'select' ? (
                <SearchableSelect
                  ariaLabel={f.label}
                  placeholder={f.placeholder ?? `Select ${f.label}`}
                  value={String(values[f.name])}
                  options={f.options ?? []}
                  onChange={(v) => set(f.name, v)}
                  className="w-full"
                />
              ) : (
                <Input
                  type="date"
                  value={String(values[f.name])}
                  min={f.minField ? String(values[f.minField]) || undefined : undefined}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </label>
          ),
        )}
      </div>
    </EntityDialog>
  );
}
