"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Database, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect, { type SearchableOption } from "@/components/forms/SearchableSelect";
import { authFetch } from "@/lib/auth/authFetch";
import { useNavigation } from "@/lib/navigation/NavigationContext";
import type { DependencyRule, ScreenKey, ScreenModel, SettingField } from "@/lib/settingManager/moduleSettings.types";

/**
 * CI include/viewChange_module_settings_v.php: title bar (Sync for brand admins, Save), the
 * module / functional area / group dropdowns (module screen; changing one reloads the page with
 * the new selection), one collapsible card per setting group (CI: sections hidden until the group
 * header is clicked; a group with an error opens), CI's show/hide rules, footer Save.
 */

const API = "/api/setting_manager/change_module_settings";
const PAGE = "/setting_manager/change_module_settings";

type Values = Record<number, string | string[]>;

const selectCls =
  "h-10 w-full max-w-xs rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function toOptions(list: { value: string | number; label: string }[]): SearchableOption[] {
  return list.map((o) => ({ value: String(o.value), label: o.label }));
}

function labelOf(field: SettingField, value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return field.options.find((o) => String(o.value) === v)?.label ?? "";
}

/** Fields hidden by CI's view-script rules for the current answers. */
function hiddenFields(model: ScreenModel, values: Values): Set<number> {
  const fields = new Map(model.groups.flatMap((g) => g.sections.flatMap((s) => s.fields)).map((f) => [f.attributeId, f]));
  const hidden = new Set<number>();
  const chosen = (attributeId: number) => {
    const f = fields.get(attributeId);
    return f ? labelOf(f, values[attributeId]).trim() : "";
  };
  for (const rule of model.rules as DependencyRule[]) {
    if (rule.kind === "parentAnswer") {
      if (chosen(rule.parentAttributeId).toLowerCase() !== rule.showWhen) {
        for (const f of fields.values()) if (f.dependsOn === rule.parentAttributeId) hidden.add(f.attributeId);
      }
    } else if (rule.kind === "selectHides") {
      if (chosen(rule.selectAttributeId).toLowerCase() === rule.whenLabel) hidden.add(rule.targetAttributeId);
    } else if (chosen(rule.radioAttributeId) !== rule.whenLabel) {
      hidden.add(rule.targetAttributeId);
    }
  }
  return hidden;
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SettingField;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  disabled: boolean;
}) {
  const id = `setting-${field.attributeId}`;
  switch (field.control) {
    case "radio":
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-5 gap-y-1 pt-2">
          {field.options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" name={id} value={o.value} checked={value === String(o.value)} disabled={disabled} onChange={() => onChange(String(o.value))} />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox": {
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-5 gap-y-1 pt-2">
          {field.options.map((o) => {
            const v = String(o.value);
            return (
              <label key={o.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={list.includes(v)}
                  disabled={disabled}
                  onChange={(e) => onChange(e.target.checked ? [...list, v] : list.filter((x) => x !== v))}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }
    case "select":
      return (
        <select id={id} className={selectCls} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {/* CI drew no empty option; an unanswered setting shows the first option. */}
          {(typeof value !== "string" || value === "") && <option value="">Select an option</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "date":
      return <Input id={id} type="date" className="max-w-xs" value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return (
        <Input id={id} className="max-w-xs" placeholder="hh:mm am" value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      );
    default:
      return (
        <Input
          id={id}
          className="max-w-md"
          inputMode={field.numeric ? "decimal" : undefined}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function ModuleSettingsForm({
  screen,
  moduleId,
  funcAreaId,
  settingGroupId,
}: {
  screen: ScreenKey;
  moduleId: string;
  funcAreaId: string;
  settingGroupId: string;
}) {
  const router = useRouter();
  const { activeTrail } = useNavigation();
  const [model, setModel] = useState<ScreenModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ screen });
    if (moduleId) p.set("moduleId", moduleId);
    if (funcAreaId) p.set("funcAreaId", funcAreaId);
    if (settingGroupId) p.set("settingGroupId", settingGroupId);
    return p.toString();
  }, [screen, moduleId, funcAreaId, settingGroupId]);

  useEffect(() => {
    let cancelled = false;
    authFetch(`${API}?${qs}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; data?: ScreenModel } | null;
        if (!res.ok || !json?.success || !json.data) throw new Error(json?.message ?? `Failed to load settings (${res.status}).`);
        return json.data;
      })
      .then((data) => {
        if (cancelled) return;
        setModel(data);
        setLoadError(null);
        setErrors({});
        setValues(Object.fromEntries(data.groups.flatMap((g) => g.sections.flatMap((s) => s.fields)).map((f) => [f.attributeId, f.value])));
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [qs, version]);

  const hidden = useMemo(() => (model ? hiddenFields(model, values) : new Set<number>()), [model, values]);

  /** CI: changing a dropdown reloads index/{module}/{funcArea}/{group}. */
  const navigate = useCallback(
    (next: { moduleId?: string; funcAreaId?: string; settingGroupId?: string }) => {
      const p = new URLSearchParams();
      const m = next.moduleId ?? moduleId;
      const f = next.funcAreaId ?? funcAreaId;
      const g = next.settingGroupId ?? settingGroupId;
      if (m && m !== "0") p.set("moduleId", m);
      if (f && f !== "0") p.set("funcAreaId", f);
      if (g && g !== "0") p.set("settingGroupId", g);
      router.push(p.toString() ? `${PAGE}?${p}` : PAGE);
    },
    [router, moduleId, funcAreaId, settingGroupId],
  );

  const save = async () => {
    if (!model) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}?${qs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v])) }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string; errors?: Record<string, string[]> } | null;
      if (!res.ok || !json?.success) {
        const fieldErrors: Record<number, string> = {};
        for (const [key, messages] of Object.entries(json?.errors ?? {})) {
          const id = Number(key.replace("answers.", ""));
          if (Number.isInteger(id)) fieldErrors[id] = messages[0];
        }
        setErrors(fieldErrors);
        // CI: a group with an error is opened and highlighted.
        if (Object.keys(fieldErrors).length) {
          const withErrors = model.groups.filter((g) => g.sections.some((s) => s.fields.some((f) => fieldErrors[f.attributeId])));
          setOpen((o) => ({ ...o, ...Object.fromEntries(withErrors.map((g) => [g.id, true])) }));
        }
        throw new Error(json?.message ?? "Save failed.");
      }
      toast.success(json.message ?? "Saved.");
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!model || !window.confirm(`${model.syncTitle}: replace this brand's settings with the system defaults?`)) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}?${qs}`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Sync failed.");
      toast.success(json.message ?? "Synced.");
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const crumbs = activeTrail.length ? activeTrail.map((n) => n.name) : ["Setting Manager"];
  const groupHasError = (groupId: number) =>
    model?.groups.find((g) => g.id === groupId)?.sections.some((s) => s.fields.some((f) => errors[f.attributeId])) ?? false;

  return (
    <div className="p-4">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header card — same design as the other forms */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500">
                {crumbs.map((c, i) => (
                  <span key={`${c}-${i}`} className={i === crumbs.length - 1 ? "font-semibold text-blue-600" : ""}>
                    {i > 0 && <ChevronRight size={15} className="mr-2 inline text-slate-400" />}
                    {c}
                  </span>
                ))}
              </nav>
              <div className="mt-2 flex items-center gap-2">
                <Database className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">{model?.title ?? "Settings"}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {model?.canSync && (
                <Button type="button" variant="outline" size="icon" title={model.syncTitle} aria-label={model.syncTitle} disabled={busy} onClick={sync} className="rounded-full border-slate-200 text-slate-600 shadow-sm">
                  <RefreshCw className="h-5 w-5" />
                </Button>
              )}
              {model?.canSave && (
                <Button type="button" size="icon" title="Save" aria-label="Save" disabled={busy} onClick={save} className="rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700">
                  <Save className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          aria-busy={busy || !model}
        >
          {loadError && <p className="text-sm text-red-600" role="alert">{loadError}</p>}
          {!model && !loadError && <p className="text-sm text-slate-400">Loading…</p>}

          {model?.filters.show && (
            // CI: chosen (searchable) dropdowns, 300px; the functional area one only for sysadmin.
            <div className="flex flex-wrap gap-2">
              <SearchableSelect
                ariaLabel="Module"
                placeholder="Select a module"
                value={moduleId || "0"}
                options={toOptions(model.filters.modules)}
                disabled={busy}
                onChange={(v) => navigate({ moduleId: v, funcAreaId: "0", settingGroupId: "0" })}
              />
              {model.filters.showFuncArea && (
                <SearchableSelect
                  ariaLabel="Functional area"
                  placeholder="Select a functional area"
                  value={funcAreaId || "0"}
                  options={toOptions(model.filters.funcAreas)}
                  disabled={busy}
                  onChange={(v) => navigate({ funcAreaId: v })}
                />
              )}
              <SearchableSelect
                ariaLabel="Setting group"
                placeholder="Select a group"
                value={settingGroupId || "0"}
                options={toOptions(model.filters.settingGroups)}
                disabled={busy}
                onChange={(v) => navigate({ settingGroupId: v })}
              />
            </div>
          )}

          {model && model.groups.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {model.filters.show ? "Select a module or a setting group to see its settings." : "There are no settings for this screen."}
            </p>
          )}

          {model?.groups.map((group) => {
            const isOpen = open[group.id] ?? false;
            return (
              <section key={group.id} className="overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [group.id]: !isOpen }))}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-white ${groupHasError(group.id) ? "bg-red-500" : "bg-slate-600"}`}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {group.name}
                </button>
                {isOpen &&
                  group.sections.map((section) => (
                    <div key={section.id} className="bg-slate-50/60 pb-2">
                      <div className="bg-slate-200/70 px-4 py-1.5 text-sm font-medium text-slate-700">{section.title}</div>
                      {section.fields.map((field) =>
                        hidden.has(field.attributeId) ? null : (
                          <div key={field.attributeId} className="grid gap-2 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] sm:items-start">
                            <label id={`setting-${field.attributeId}-label`} htmlFor={`setting-${field.attributeId}`} className="pt-2 text-sm text-slate-700">
                              {field.label}
                            </label>
                            <div>
                              <FieldControl
                                field={field}
                                value={values[field.attributeId] ?? (field.control === "checkbox" ? [] : "")}
                                disabled={busy || !model.canSave}
                                onChange={(v) => setValues((prev) => ({ ...prev, [field.attributeId]: v }))}
                              />
                              {errors[field.attributeId] && (
                                <p className="mt-1 text-xs text-red-600" role="alert">{errors[field.attributeId]}</p>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ))}
              </section>
            );
          })}

          {model?.canSave && (
            <div className="border-t border-slate-100 pt-4">
              <Button type="submit" disabled={busy} className="h-10 rounded-full !bg-none !bg-blue-600 px-6 text-sm font-semibold text-white hover:!bg-blue-700">
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
