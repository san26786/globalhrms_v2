import SearchableSelect from "@/components/forms/SearchableSelect";
import type { PeriodListFilters } from "@/lib/periodMngt/period.types";

type Option = { value: string | number; label: string };

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Option[]; onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <SearchableSelect
        ariaLabel={label}
        placeholder={`Select ${label}`}
        className="w-full"
        value={value || "0"}
        options={options.map((o) => ({ value: String(o.value), label: o.label }))}
        onChange={onChange}
      />
    </label>
  );
}

export default function PeriodFilterBar({ filters, periodTypeId, periodStatusId, onChange }: {
  filters: PeriodListFilters | null;
  periodTypeId: string;
  periodStatusId: string;
  onChange: (next: { periodTypeId: string; periodStatusId: string }) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      <FilterSelect
        label="Period Type"
        value={periodTypeId}
        options={filters?.periodTypes ?? []}
        onChange={(v) => onChange({ periodTypeId: v, periodStatusId })}
      />
      <FilterSelect
        label="Period Status"
        value={periodStatusId}
        options={filters?.periodStatuses ?? []}
        onChange={(v) => onChange({ periodTypeId, periodStatusId: v })}
      />
    </div>
  );
}