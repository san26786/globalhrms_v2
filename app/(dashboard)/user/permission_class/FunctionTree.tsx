'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EMPTY_FLAGS, type FunctionFlags, type FunctionModule } from '@/lib/user/permissionClass/types';

/**
 * Function tab (CI #function_drop + get_epic_for_module): one row per module with a checkbox and a
 * collapsible list of its screens, each with Enabled / Readonly / Modify / Delete / Insert (CI's
 * Print / Execute columns are commented out). State lives in the parent, keyed by REL_DET_ID, so
 * collapsed modules keep their state and are saved too.
 */
const FLAG_COLUMNS: Array<{ key: keyof FunctionFlags; label: string }> = [
  { key: 'enabled', label: 'Enabled' },
  { key: 'readonly', label: 'Readonly' },
  { key: 'modify', label: 'Modify' },
  { key: 'delete', label: 'Delete' },
  { key: 'insert', label: 'Insert' },
];

export interface FunctionTreeState {
  /** Module REL_DET_ID → module checkbox (CI module[] checkbox of the parent row). */
  modules: Record<number, boolean>;
  /** Screen REL_DET_ID → flags. */
  flags: Record<number, FunctionFlags>;
}

interface FunctionTreeProps {
  modules: FunctionModule[];
  state: FunctionTreeState;
  onChange: (next: FunctionTreeState) => void;
  disabled?: boolean;
}

export default function FunctionTree({ modules, state, onChange, disabled }: FunctionTreeProps) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  /** CI: ticking a module ticks every flag of its screens; unticking clears them. */
  const toggleModule = (mod: FunctionModule, checked: boolean) => {
    const flags = { ...state.flags };
    for (const child of mod.children) {
      flags[child.relDetId] = { enabled: checked, readonly: checked, modify: checked, delete: checked, insert: checked };
    }
    onChange({ modules: { ...state.modules, [mod.relDetId]: checked }, flags });
  };

  const setFlag = (relDetId: number, key: keyof FunctionFlags, value: boolean) => {
    const current = state.flags[relDetId] ?? EMPTY_FLAGS;
    onChange({ ...state, flags: { ...state.flags, [relDetId]: { ...current, [key]: value } } });
  };

  if (modules.length === 0) {
    return <p className="py-4 text-sm text-slate-500">No modules are available for this brand.</p>;
  }

  return (
    <ul className="divide-y rounded-md border border-slate-200" aria-label="Functions">
      {modules.map((mod) => {
        const isOpen = open[mod.relDetId] ?? false;
        const panelId = `fn-${mod.relDetId}`;
        return (
          <li key={mod.relDetId} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [mod.relDetId]: !isOpen }))}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${mod.name}`}
                disabled={mod.children.length === 0}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={state.modules[mod.relDetId] ?? false}
                  disabled={disabled}
                  onChange={(e) => toggleModule(mod, e.target.checked)}
                />
                {mod.name}
              </label>
              <span className="text-xs text-slate-400">({mod.children.length})</span>
            </div>

            {isOpen && mod.children.length > 0 && (
              <div id={panelId} className="mt-2 overflow-x-auto pl-8">
                <table className="w-full max-w-3xl text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="py-1 text-left font-medium">Screen</th>
                      {FLAG_COLUMNS.map((c) => (
                        <th key={c.key} className="px-2 py-1 text-center font-medium">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mod.children.map((child) => {
                      const flags = state.flags[child.relDetId] ?? EMPTY_FLAGS;
                      return (
                        <tr key={child.relDetId} className="border-t border-slate-100">
                          <td className="py-1 pr-2 text-slate-700">{child.name}</td>
                          {FLAG_COLUMNS.map((c) => (
                            <td key={c.key} className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${child.name}: ${c.label}`}
                                checked={flags[c.key]}
                                disabled={disabled}
                                onChange={(e) => setFlag(child.relDetId, c.key, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
