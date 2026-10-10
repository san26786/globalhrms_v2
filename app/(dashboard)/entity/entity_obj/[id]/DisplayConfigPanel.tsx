"use client";

import { RotateCcw, Save, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDisplayConfig } from "@/lib/entity/display/useDisplayConfig";

/**
 * Column configuration (CI "Form Config" flash modal of entity_obj_attrbt::updateFlashModal and
 * the inline label editor common_c::getLabel):
 *  - system admin: global visibility + SYSTEM label / list / form defaults; "Apply to all brands".
 *  - brand admin: their brand's label / list / form for globally visible columns; "Reset to default".
 * Only changed rows are sent (PUT). State lives in useDisplayConfig (shared with the list-view modal).
 */
export default function DisplayConfigPanel({ objId }: { objId: number }) {
  const { config, error, drafts, changes, busy, update, save: saveConfig, reset: resetConfig, applyAll: applyAllConfig } =
    useDisplayConfig(`/api/entity/entity_obj/${objId}/display`);

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed.");
    }
  };

  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>;
  if (!config) return <p className="p-4 text-sm text-gray-400">Loading...</p>;

  const sysAdmin = config.adminLevel === 2;
  const save = () =>
    run(async () => {
      await saveConfig();
      toast.success("Successfully updated configuration.");
    });

  const reset = () =>
    run(async () => {
      const data = await resetConfig();
      toast.success(`Labels reset to default (${data.updated} row(s)).`);
    });

  const applyAll = () =>
    run(async () => {
      if (!window.confirm("Remove every brand-specific configuration of this object so all brands use the system configuration?")) return;
      const data = await applyAllConfig();
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
