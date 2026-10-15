'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Two-list picker (CI bootstrap-duallistbox): available on the left, selected on the right, each
 * with a filter, an info line ("Showing all 76" / "Filtered 3 from 76" / "Empty list") and a
 * "show all" button that clears the filter; move / remove the highlighted items or all filtered
 * items (double-click or Enter moves too). Controlled: the parent owns `selected`, so the
 * selection survives tab switches and is submitted as one array.
 */
export interface DualListOption {
  value: number;
  label: string;
}

interface DualListBoxProps {
  label: string;
  options: DualListOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  disabled?: boolean;
}

function filterBy(options: DualListOption[], text: string) {
  const needle = text.trim().toLowerCase();
  return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
}

/** bootstrap-duallistbox infoText / infoTextFiltered / infoTextEmpty. */
function infoText(shown: number, total: number) {
  if (total === 0) return 'Empty list';
  return shown === total ? `Showing all ${total}` : `Filtered ${shown} from ${total}`;
}

function ListPane({
  id,
  title,
  options,
  total,
  filter,
  onFilter,
  highlighted,
  onHighlight,
  onActivate,
  disabled,
}: {
  id: string;
  title: string;
  options: DualListOption[];
  total: number;
  filter: string;
  onFilter: (v: string) => void;
  highlighted: number[];
  onHighlight: (ids: number[]) => void;
  onActivate: (ids: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs text-slate-600">
          <span className="sr-only">{title}: </span>
          {infoText(options.length, total)}
        </label>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={disabled || !filter} onClick={() => onFilter('')}>
          show all
        </Button>
      </div>
      <Input value={filter} onChange={(e) => onFilter(e.target.value)} placeholder="Filter" aria-label={`Filter ${title}`} className="h-8 text-xs" disabled={disabled} />
      <select
        id={id}
        multiple
        size={10}
        disabled={disabled}
        value={highlighted.map(String)}
        onChange={(e) => onHighlight(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
        onDoubleClick={() => onActivate(highlighted)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onActivate(highlighted);
          }
        }}
        className="h-56 w-full rounded-md border border-slate-200 bg-white p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="rounded px-2 py-1">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DualListBox({ label, options, selected, onChange, disabled }: DualListBoxProps) {
  const baseId = useId();
  const [leftFilter, setLeftFilter] = useState('');
  const [rightFilter, setRightFilter] = useState('');
  const [leftHighlight, setLeftHighlight] = useState<number[]>([]);
  const [rightHighlight, setRightHighlight] = useState<number[]>([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const available = useMemo(() => options.filter((o) => !selectedSet.has(o.value)), [options, selectedSet]);
  // Selected ids without an option (e.g. a user since removed) are still shown, by id, so they can be removed.
  const chosen = useMemo(
    () => selected.map((value) => ({ value, label: labelOf.get(value) ?? `#${value}` })),
    [selected, labelOf],
  );
  const leftShown = filterBy(available, leftFilter);
  const rightShown = filterBy(chosen, rightFilter);

  const add = (ids: number[]) => {
    if (!ids.length) return;
    onChange([...selected, ...ids.filter((id) => !selectedSet.has(id))]);
    setLeftHighlight([]);
  };
  const remove = (ids: number[]) => {
    if (!ids.length) return;
    const drop = new Set(ids);
    onChange(selected.filter((id) => !drop.has(id)));
    setRightHighlight([]);
  };

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <ListPane
        id={`${baseId}-available`}
        title={`Available ${label}`}
        options={leftShown}
        total={available.length}
        filter={leftFilter}
        onFilter={setLeftFilter}
        highlighted={leftHighlight}
        onHighlight={setLeftHighlight}
        onActivate={add}
        disabled={disabled}
      />
      <div className="flex shrink-0 flex-row items-center justify-center gap-1 sm:flex-col">
        <Button type="button" variant="outline" size="icon" title="Move selected" aria-label="Move selected" disabled={disabled || !leftHighlight.length} onClick={() => add(leftHighlight)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" title="Move all" aria-label="Move all" disabled={disabled || !leftShown.length} onClick={() => add(leftShown.map((o) => o.value))}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" title="Remove selected" aria-label="Remove selected" disabled={disabled || !rightHighlight.length} onClick={() => remove(rightHighlight)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" title="Remove all" aria-label="Remove all" disabled={disabled || !rightShown.length} onClick={() => remove(rightShown.map((o) => o.value))}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
      <ListPane
        id={`${baseId}-selected`}
        title={`Selected ${label}`}
        options={rightShown}
        total={chosen.length}
        filter={rightFilter}
        onFilter={setRightFilter}
        highlighted={rightHighlight}
        onHighlight={setRightHighlight}
        onActivate={remove}
        disabled={disabled}
      />
    </div>
  );
}
