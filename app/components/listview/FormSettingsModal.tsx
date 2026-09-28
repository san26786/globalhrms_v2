'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDisplayConfig } from '@/lib/entity/display/useDisplayConfig';

/**
 * "Form Settings" — port of CI footer_v.php #configform (the list view's cog icon).
 *
 * One row per column attribute of the list's object (CI $getSystemData):
 *  - System Column Name: OBJ_ATTRBT_NM, read-only.
 *  - Display Column Name: the label for the caller's scope; double-click to rename
 *    (CI changeLabel()/updateLabel() → common_c::getLabel).
 *  - Visible in List — forks by admin level exactly like CI:
 *      super admin (2): the GLOBAL entity_obj_attrbt.IS_VISIBLE (updateByFlash);
 *      brand admin (1): the brand's IS_VISIBLE_FOR_LISTVIEW ($getVisibleColForLV, updateByFlashForLV).
 *  - Visible in Form: IS_VISIBLE_FOR_FORMVIEW for the caller's scope ($getVisibleColForFV).
 *  - Header "select all" boxes (CI checkAllListConfigColumns / checkAllFormConfigColumns).
 *  - Buttons: Close, Save changes, and for the super admin "Save For All Brands"
 *    (updateFlashModal with saveForAll → applyToAllBrands).
 * Users (level 0) never get here: the list shell hides the cog, and the API refuses them.
 *
 * Differences from CI, kept visible on purpose:
 *  - CI QUIRK: the Reset button (#resetFormSetting) is rendered with class "hidden" and no script
 *    in common.js/core.js ever un-hides it, so CI users could never reset; and its AJAX success
 *    branch (`data == 'true'`, loose string compare) was a no-op (the reload is commented out), so
 *    even a reset would not show. Here Reset is offered to brand admins and the table reloads with
 *    the reset labels.
 *  - CI QUIRK: updateLabel() re-renders the label with ondblclick='changeLabel(id)' WITHOUT the
 *    table name, so a second rename in the same modal posted to a broken URL. Here renames can be
 *    repeated.
 *  - CI saved a renamed label immediately on blur; here renames are part of the draft and are
 *    saved (or discarded by Close) together with the checkboxes.
 */
export default function FormSettingsModal({
  objectName,
  open,
  onOpenChange,
  onSaved,
}: {
  /** CI $pvs_ObjNm — the list's entity object, e.g. 'user_role_vw' or 'menu_config'. */
  objectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save/reset so the list can re-read its columns. */
  onSaved?: () => void;
}) {
  const { config, error, drafts, changes, busy, update, setAll, save, reset, discard } = useDisplayConfig(
    open ? `/api/entity/display-config/${encodeURIComponent(objectName)}` : null,
  );
  const [editing, setEditing] = useState<number | null>(null);

  const sysAdmin = config?.adminLevel === 2;
  // CI getAllEntityObjAttrbt(): below super admin only globally visible (IS_VISIBLE = 1) columns are
  // listed at all — only the super admin can switch a hidden column on for everyone.
  const rows = (config?.rows ?? []).filter((r) => sysAdmin || r.isVisible);
  const editable = (isVisible: boolean) => sysAdmin || isVisible;
  const listField = sysAdmin ? ('isVisible' as const) : ('listView' as const);
  const editableRows = rows.filter((r) => editable(r.isVisible));
  const allList = editableRows.length > 0 && editableRows.every((r) => drafts[r.attributeId]?.[listField]);
  const allForm = editableRows.length > 0 && editableRows.every((r) => drafts[r.attributeId]?.formView);

  const close = () => {
    discard();
    setEditing(null);
    onOpenChange(false);
  };

  const submit = async (saveForAll: boolean) => {
    if (saveForAll && !window.confirm('Save this configuration and remove every brand-specific override so all brands use it?')) return;
    try {
      await save({ saveForAll });
      toast.success(saveForAll ? 'Successfully updated for all brands.' : 'Successfully updated configuration.');
      setEditing(null);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the configuration.');
    }
  };

  const resetLabels = async () => {
    try {
      const data = await reset();
      toast.success(`Labels reset to default (${data.updated} row(s)).`);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reset the labels.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Form Settings</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {error && <p className="p-5 text-sm text-red-600">{error}</p>}
          {!error && !config && <p className="p-5 text-sm text-slate-400">Loading...</p>}
          {config && (
            <table className="w-full text-sm">
              <thead className="text-slate-600 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">System Column Name</th>
                  <th className="px-3 py-2.5 text-left font-medium">Display Column Name</th>
                  <th className="px-3 py-2.5 text-center font-medium">
                    <label className="inline-flex items-center gap-2">
                      Visible in List
                      <input type="checkbox" aria-label="Select all visible in list" checked={allList} onChange={(e) => setAll(listField, e.target.checked, (r) => editable(r.isVisible))} />
                    </label>
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium">
                    <label className="inline-flex items-center gap-2">
                      Visible in Form
                      <input type="checkbox" aria-label="Select all visible in form" checked={allForm} onChange={(e) => setAll('formView', e.target.checked, (r) => editable(r.isVisible))} />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const d = drafts[row.attributeId];
                  if (!d) return null;
                  const canEdit = editable(row.isVisible);
                  return (
                    <tr key={row.attributeId} className={`border-b last:border-0 ${canEdit ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-2.5 text-slate-600">{row.name}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {editing === row.attributeId && canEdit ? (
                          <input
                            autoFocus
                            aria-label={`${row.name} display name`}
                            className="w-full rounded border border-slate-300 px-2 py-1"
                            maxLength={50}
                            value={d.label}
                            onChange={(e) => update(row.attributeId, { label: e.target.value })}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEditing(null)}
                          />
                        ) : (
                          <span
                            role="button"
                            tabIndex={canEdit ? 0 : -1}
                            title={canEdit ? 'Double-click to rename' : undefined}
                            className={canEdit ? 'cursor-text' : ''}
                            onDoubleClick={() => canEdit && setEditing(row.attributeId)}
                            onKeyDown={(e) => canEdit && e.key === 'Enter' && setEditing(row.attributeId)}
                          >
                            {d.label || <span className="text-blue-600 underline">Add</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${row.name} visible in list`}
                          disabled={!canEdit}
                          checked={d[listField]}
                          onChange={(e) => update(row.attributeId, { [listField]: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${row.name} visible in form`}
                          disabled={!canEdit}
                          checked={d.formView}
                          onChange={(e) => update(row.attributeId, { formView: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      This list has no configurable columns.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {config && !sysAdmin && (
            <Button type="button" variant="destructive" disabled={busy} onClick={resetLabels} className="mr-auto">
              Reset
            </Button>
          )}
          {sysAdmin && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => submit(true)}>
              Save For All Brands
            </Button>
          )}
          <Button type="button" variant="outline" onClick={close}>
            Close
          </Button>
          <Button type="button" disabled={busy || !config || changes.length === 0} onClick={() => submit(false)}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
