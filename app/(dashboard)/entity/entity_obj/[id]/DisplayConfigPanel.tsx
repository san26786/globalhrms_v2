"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/authFetch";
import type { DisplayConfig, DisplayConfigRow } from "@/lib/entity/display/displayConfig.service";

/**
 * Column configuration (CI "Form Config" flash modal of entity_obj_attrbt::updateFlashModal and
 * the inline label editor common_c::getLabel):
 *  - system admin: global visibility + SYSTEM label / list / form defaults; "Apply to all brands".
 *  - brand admin: their brand's label / list / form for globally visible columns; "Reset to default".
 * Only changed rows are sent (PUT).
 */
interface Draft {
  isVisible: boolean;
  label: string;
  listView: boolean;
  formView: boolean;
}

function draftOf(row: DisplayConfigRow, level: 1 | 2): Draft {
  const scope = level === 2 ? row.system : row.brand;
  return {
    isVisible: row.isVisible,
    label: scope?.label || (level === 2 ? row.defaultLabel : row.effective.label),
    listView: scope?.listView ?? row.effective.listView,
    formView: scope?.formView ?? row.effective.formView,
  };
}

async function call(url: string, init?: RequestInit): Promise<unknown> {
  const res = await authFetch(url, init);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message ?? "Request failed.");
  return json.data;
}

export default function DisplayConfigPanel({ objId }: { objId: number }) {
  const base = `/api/entity/entity_obj/${objId}/display`;
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((next: DisplayConfig) => {
    setConfig(next);
    setDrafts(Object.fromEntries(next.rows.map((r) => [r.attributeId, draftOf(r, next.adminLevel)])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    call(base)
      .then((data) => !cancelled && apply(data as DisplayConfig))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load configuration."));
    return () => {
      cancelled = true;
    };
  }, [base, apply]);

  const changes = useMemo((): Array<{ attributeId: number } & Partial<Draft>> => {
    if (!config) return [];
    return config.rows.flatMap((row) => {
      const before = draftOf(row, config.adminLevel);
      const now = drafts[row.attributeId];
      if (!now) return [];
      const diff: Partial<Draft> = {};
      if (config.adminLevel === 2 && now.isVisible !== before.isVisible) diff.isVisible = now.isVisible;
      if (now.label.trim() !== before.label) diff.label = now.label.trim();
      if (now.listView !== before.listView) diff.listView = now.listView;
      if (now.formView !== before.formView) diff.formView = now.formView;
      return Object.keys(diff).length ? [{ attributeId: row.attributeId, ...diff }] : [];
    });
  }, [config, drafts]);

  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>;
  if (!config) return <p className="p-4 text-sm text-gray-400">Loading...</p>;

  const sysAdmin = config.adminLevel === 2;
  const update = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (changes.some((c) => c.label === "")) throw new Error("Labels cannot be empty.");
      apply(
        (await call(base, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: changes }),
        })) as DisplayConfig,
      );
      toast.success("Successfully updated configuration.");
    });

  const reset = () =>
    run(async () => {
      const data = (await call(`${base}/reset`, { method: "POST" })) as { updated: number; config: DisplayConfig };
      apply(data.config);
      toast.success(`Labels reset to default (${data.updated} row(s)).`);
    });

  const applyAll = () =>
    run(async () => {
      if (!window.confirm("Remove every brand-specific configuration of this object so all brands use the system configuration?")) return;
      const data = (await call(`${base}/apply-all`, { method: "POST" })) as { removed: number; config: DisplayConfig };
      apply(data.config);
      toast.success(`Successfully updated for all brands (${data.removed} override(s) removed).`);
    });

  return (
    <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {sysAdmin
            ? `System configuration of ${config.objNm}. Brand overrides: ${config.brandOverrideCount}.`
            : `Your brand's configuration of ${config.objNm}. Columns hidden globally are not listed as editable.`}
        </p>
        <div className="flex gap-2">
          {sysAdmin ? (
            <Button type="button" variant="outline" disabled={busy || config.brandOverrideCount === 0} onClick={applyAll}>
              <Share2 className="mr-1 h-4 w-4" /> Apply to all brands
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={busy} onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset to default
            </Button>
          )}
          <Button type="button" disabled={busy || changes.length === 0} onClick={save}>
            <Save className="mr-1 h-4 w-4" /> Save{changes.length ? ` (${changes.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Column</th>
              <th className="py-2 pr-3">Type</th>
              {sysAdmin && <th className="py-2 pr-3">Visible (global)</th>}
              <th className="py-2 pr-3">{sysAdmin ? "System label" : "Label"}</th>
              <th className="py-2 pr-3">List view</th>
              <th className="py-2 pr-3">Form view</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row) => {
              const d = drafts[row.attributeId];
              if (!d) return null;
              const editable = sysAdmin || row.isVisible;
              return (
                <tr key={row.attributeId} className={`border-b last:border-0 ${editable ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-3 text-slate-400">{row.seq}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.dataType}</td>
                  {sysAdmin && (
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`${row.name} visible`}
                        checked={d.isVisible}
                        onChange={(e) => update(row.attributeId, { isVisible: e.target.checked })}
                      />
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <Input
                      className="w-full min-w-48"
                      aria-label={`${row.name} label`}
                      value={d.label}
                      maxLength={50}
                      disabled={!editable}
                      placeholder={row.defaultLabel}
                      onChange={(e) => update(row.attributeId, { label: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`${row.name} list view`}
                      checked={d.listView}
                      disabled={!editable}
                      onChange={(e) => update(row.attributeId, { listView: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`${row.name} form view`}
                      checked={d.formView}
                      disabled={!editable}
                      onChange={(e) => update(row.attributeId, { formView: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
            {config.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  This object has no attributes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
