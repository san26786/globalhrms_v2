'use client';

/**
 * Permission Class form (add + edit) — port of CI include/viewPermissionDtl_v.php.
 *
 * CI → Next.js
 *  permission_dtl::newPermissionDtl / editPermissionDtl → initForm  GET  /api/user/permission_class/init?classId=
 *  permission_dtl_m::get_enabled_module / getAllDataByPermissionClassID   (part of the init response)
 *  manager_m::getAllModulesForPermission + permission_dtl::get_epic_for_module
 *                                                                   (init: the whole tree, loaded up front
 *                                                                    like CI's rePopulateItems, so collapsed
 *                                                                    modules are saved correctly)
 *  permission_dtl::smartSearchPermissionClass                      GET  /api/user/permission_class/search?q=
 *  permission_dtl::getAllPermission (pick an existing class)       GET  /api/user/permission_class/init?classId=
 *  permission_dtl::getUserListForOaId/{OaId}                       GET  /api/user/permission_class/org/{oaId}
 *  permission_dtl::insert → setFormControls (add AND edit)         POST /api/user/permission_class
 *  permission_class::delete/{id}                                   DELETE /api/user/permission_class/{id}  (list row action)
 *  permission_class::sync_permissions                              POST /api/user/permission_class/sync    (list header action)
 *  OrgDetailsView: Merchant Account / Brand (super admin)          /api/lookups/organisations, /api/lookups/brands?oaId=
 *                  Requested By (admins; the brand's users)        init.requestedByUsers, GET /api/user/permission_class/brand/{id}/users
 *  CI $controls: the class-name autocomplete (setAutocompleteControl) and "Access Write"
 *  (setCheckboxControl, SYSTEMPERMISSIONTYPE masters → permission_dtl rows with PERMISSIONS_ID).
 *  Also reached from Permission Details (user/permission_dtl/add); CI returned to user/permission_class.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Database, Save, User, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DualListBox from '@/components/forms/DualListBox';
import { authFetch } from '@/lib/auth/authFetch';
import { useNavigation } from '@/lib/navigation/NavigationContext';
import type { FunctionFlags, IdOption, OrgRefOptions, PermissionClassInit } from '@/lib/user/permissionClass/types';
import { EMPTY_FLAGS } from '@/lib/user/permissionClass/types';
import FunctionTree, { type FunctionTreeState } from './FunctionTree';

const LIST_PATH = '/user/permission_class';
const API = '/api/user/permission_class';

type TabKey = 'user' | 'userGroup' | 'role' | 'function';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'user', label: 'User' },
  { key: 'userGroup', label: 'User Group' },
  { key: 'role', label: 'Role' },
  { key: 'function', label: 'Function' },
];

type FieldErrors = Partial<Record<'permissionClassName' | 'oaId' | 'oaBrandId' | 'userId' | 'users' | 'form', string>>;

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await authFetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json?.success) throw new Error(json?.message ?? `Request failed (${res.status}).`);
  return json.data as T;
}

/** Tree state from the server's REL_DET_ID → flags map (CI: module ticked when it has a row). */
function treeStateFrom(init: PermissionClassInit): FunctionTreeState {
  const modules: Record<number, boolean> = {};
  const flags: Record<number, FunctionFlags> = {};
  for (const mod of init.modules) {
    modules[mod.relDetId] = !!init.selection.functions[mod.relDetId];
    for (const child of mod.children) flags[child.relDetId] = init.selection.functions[child.relDetId] ?? EMPTY_FLAGS;
  }
  return { modules, flags };
}

const CLASS_NAME = /^[A-Za-z ]+$/;

const selectCls =
  'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e15425]/40 disabled:opacity-60';

export default function PermissionClassForm({ mode, classId }: { mode: 'add' | 'edit'; classId?: number }) {
  const router = useRouter();
  const { activeTrail } = useNavigation();

  const [init, setInit] = useState<PermissionClassInit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingClass, setLoadingClass] = useState(false);

  // Form state
  const [className, setClassName] = useState('');
  const [pickedClassId, setPickedClassId] = useState<number | null>(null);
  const [oaId, setOaId] = useState<number | null>(null);
  const [oaBrandId, setOaBrandId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [options, setOptions] = useState<OrgRefOptions>({ users: [], userGroups: [], roles: [] });
  const [accessPermissions, setAccessPermissions] = useState<number[]>([]);
  const [requestedByUsers, setRequestedByUsers] = useState<IdOption[]>([]);
  const [users, setUsers] = useState<number[]>([]);
  const [userGroups, setUserGroups] = useState<number[]>([]);
  const [roles, setRoles] = useState<number[]>([]);
  const [tree, setTree] = useState<FunctionTreeState>({ modules: {}, flags: {} });
  const [tab, setTab] = useState<TabKey>('user');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // Organisation / brand dropdowns (admins only)
  const [orgs, setOrgs] = useState<IdOption[]>([]);
  const [brands, setBrands] = useState<IdOption[]>([]);

  /** Fill the whole form from an init response (first load, or an existing class picked by name). */
  const apply = useCallback((data: PermissionClassInit) => {
    setInit(data);
    setClassName(data.className);
    setPickedClassId(data.classId);
    setOaId(data.oaId);
    setOaBrandId(data.oaBrandId);
    setUserId(data.userId);
    setOptions({ users: data.users, userGroups: data.userGroups, roles: data.roles });
    setAccessPermissions(data.selection.accessPermissions);
    setRequestedByUsers(data.requestedByUsers);
    setUsers(data.selection.users);
    setUserGroups(data.selection.userGroups);
    setRoles(data.selection.roles);
    setTree(treeStateFrom(data));
    setErrors({});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = mode === 'edit' && classId ? `?classId=${classId}` : '';
    getJson<PermissionClassInit>(`${API}/init${qs}`)
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load the form.');
      });
    return () => {
      cancelled = true;
    };
  }, [mode, classId, apply]);

  // CI OrgDetailsView: super admin sees Merchant Account / Brand / Requested By; admin only Requested By.
  const isAdmin = (init?.adminLevel ?? 0) !== 0;
  const isSysAdmin = init?.adminLevel === 2;

  // Organisations (super admin) — scoped by the lookup service.
  useEffect(() => {
    if (!isSysAdmin) return;
    let cancelled = false;
    getJson<Array<{ value: number; label: string }>>('/api/lookups/organisations')
      .then((list) => {
        if (!cancelled) setOrgs(list);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSysAdmin]);

  // Brands of the chosen organisation (super admin).
  useEffect(() => {
    if (!isSysAdmin || !oaId) return;
    let cancelled = false;
    getJson<Array<{ value: number; label: string }>>(`/api/lookups/brands?oaId=${oaId}`)
      .then((list) => {
        if (!cancelled) setBrands(list);
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSysAdmin, oaId]);

  /** CI (super admin): changing the organisation reloads its users, roles and user groups. */
  const changeOrg = async (next: number | null) => {
    setOaId(next);
    setOaBrandId(null);
    setUserId(null);
    setBrands([]);
    setRequestedByUsers([]);
    if (!next) {
      setOptions({ users: [], userGroups: [], roles: [] });
      return;
    }
    try {
      const opts = await getJson<OrgRefOptions>(`${API}/org/${next}`);
      setOptions(opts);
      // Ids of another organisation cannot be granted — drop them from the selection.
      const keep = (ids: number[], list: IdOption[]) => ids.filter((id) => list.some((o) => o.value === id));
      setUsers((ids) => keep(ids, opts.users));
      setUserGroups((ids) => keep(ids, opts.userGroups));
      setRoles((ids) => keep(ids, opts.roles));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the organisation’s users.');
    }
  };

  /** CI Brand onchange → changeDropdown(…, 'user', dependableUserBasedOnOrgBrand): reload Requested By. */
  const changeBrand = async (next: number | null) => {
    setOaBrandId(next);
    setUserId(null);
    setRequestedByUsers([]);
    if (!next) return;
    try {
      setRequestedByUsers(await getJson<IdOption[]>(`${API}/brand/${next}/users`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the brand’s users.');
    }
  };

  // ---------------------------------------------------------------- class-name autocomplete
  const [suggestions, setSuggestions] = useState<IdOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = className.trim();
    if (!showSuggestions || q.length < 1) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      getJson<IdOption[]>(`${API}/search?q=${encodeURIComponent(q)}`)
        .then((list) => {
          if (seq === searchSeq.current) setSuggestions(list);
        })
        .catch(() => {
          if (seq === searchSeq.current) setSuggestions([]);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [className, showSuggestions]);

  /** CI: picking a suggestion sets permission_class_ID and loads that class (getAllPermission). */
  const pickClass = async (option: IdOption) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setLoadingClass(true);
    try {
      apply(await getJson<PermissionClassInit>(`${API}/init?classId=${option.value}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load the permission class.');
    } finally {
      setLoadingClass(false);
    }
  };

  // ---------------------------------------------------------------- save
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const name = className.trim();
    if (!name) next.permissionClassName = 'Permission Class Field is required.';
    else if (!CLASS_NAME.test(name)) next.permissionClassName = 'Permission Class may only contain letters and spaces.';
    if (isAdmin) {
      if (isSysAdmin && !oaId) next.oaId = 'The Merchant Account field is required.';
      if (isSysAdmin && !oaBrandId) next.oaBrandId = 'The Brand field is required.';
      if (!userId) next.userId = 'Please select Requested By';
    }
    // CI form script: at least one user must be selected (jumps to the User tab).
    if (users.length === 0) next.users = 'Please select at least one user.';
    return next;
  };

  const functionsPayload = useMemo(() => {
    if (!init) return [];
    // CI submit: a ticked module posts module[] with enabled = 1; every screen of every module posts
    // module[] with its own flags (all screens were in the page, expanded or not).
    return init.modules.flatMap((mod) => [
      ...(tree.modules[mod.relDetId] ? [{ relDetId: mod.relDetId, ...EMPTY_FLAGS, enabled: true }] : []),
      ...mod.children.map((child) => ({ relDetId: child.relDetId, ...(tree.flags[child.relDetId] ?? EMPTY_FLAGS) })),
    ]);
  }, [init, tree]);

  const save = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      if (found.users && !found.permissionClassName && !found.oaId && !found.oaBrandId && !found.userId) setTab('user');
      toast.error(Object.values(found)[0] ?? 'Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionClassName: className.trim(),
          permissionClassId: pickedClassId ?? undefined,
          oaId: oaId ?? undefined,
          oaBrandId: oaBrandId ?? undefined,
          userId: userId ?? undefined,
          accessPermissions,
          users,
          userGroups,
          roles,
          functions: functionsPayload,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ classId: number; message: string }> | null;
      if (!res.ok || !json?.success) {
        if (json?.errors) {
          const mapped: FieldErrors = {};
          for (const [key, messages] of Object.entries(json.errors)) {
            const k = (key in { permissionClassName: 1, oaId: 1, oaBrandId: 1, userId: 1, users: 1 } ? key : 'form') as keyof FieldErrors;
            mapped[k] = messages[0];
          }
          setErrors(mapped);
        }
        throw new Error(json?.message ?? 'Save failed.');
      }
      toast.success(json.message ?? json.data?.message ?? 'Saved.');
      router.push(LIST_PATH);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => router.push(LIST_PATH);

  // ---------------------------------------------------------------- render
  const crumbs = activeTrail.length ? activeTrail.map((n) => n.name) : ['Profile and Permissions', 'Profile Class'];
  const title = init?.title ?? (mode === 'edit' ? 'Edit Permission Details' : 'New Permission Details');
  const busy = saving || loadingClass || !init;

  if (loadError) {
    return (
      <div className="p-4">
        <p className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 text-sm text-rose-700 dark:text-rose-300 shadow-sm">{loadError}</p>
      </div>
    );
  }

  const fieldError = (key: keyof FieldErrors) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="p-4">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header card — same design as DynamicForm */}
        <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] before:absolute before:inset-x-8 before:top-0 before:h-1 before:rounded-b-full before:bg-gradient-to-r before:from-[#e15425] before:to-[#0b5394] dark:border-white/10 dark:bg-[#111a2e]">
          <div className="flex items-start justify-between">
            <div>
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
                {crumbs.map((crumb) => (
                  <span key={crumb} className="flex items-center gap-2">
                    <span>{crumb}</span>
                    <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
                  </span>
                ))}
                <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">{mode === 'add' ? 'Add' : 'Edit'}</span>
              </nav>
              <div className="mt-3 flex items-center gap-3">
                <Database className="h-11 w-11 shrink-0 rounded-xl bg-[#fbe6dd] p-2.5 text-[#b4441f] dark:bg-[#da5427]/15 dark:text-[#f8a27e]" />
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#1a1818] dark:text-[#f1f3f8] md:text-[32px]">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={save}
                disabled={busy}
                size="icon"
                title="Save"
                aria-label="Save"
                className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30"
              >
                <Save className="h-5 w-5 stroke-[2.5]" />
              </Button>
              <Button type="button" onClick={cancel} variant="outline" size="icon" title="Cancel" aria-label="Cancel" className="rounded-full border-slate-200 dark:border-white/10 text-[#323338] dark:text-[#d5dae4] shadow-sm">
                <X className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="bg-white dark:bg-[#111a2e] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm space-y-6"
          aria-busy={busy}
        >
          {!init ? (
            <p className="text-sm text-[#535768] dark:text-[#aab3c5]">Loading…</p>
          ) : (
            <>
              {/* CI OrgDetailsView: Merchant Account + Brand for the super admin, Requested By for admins */}
              {isAdmin && (
                <div className={`grid gap-4 ${isSysAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {isSysAdmin && (
                    <div>
                      <label htmlFor="pc-org" className="mb-1 block text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                        Merchant Account
                      </label>
                      <select
                        id="pc-org"
                        className={selectCls}
                        value={oaId ?? ''}
                        disabled={busy}
                        onChange={(e) => void changeOrg(e.target.value ? Number(e.target.value) : null)}
                        aria-invalid={!!errors.oaId}
                      >
                        <option value="">Select Organisation</option>
                        {orgs.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {fieldError('oaId')}
                    </div>
                  )}
                  {isSysAdmin && (
                    <div>
                      <label htmlFor="pc-brand" className="mb-1 block text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                        Brand
                      </label>
                      <select
                        id="pc-brand"
                        className={selectCls}
                        value={oaBrandId ?? ''}
                        disabled={busy || !oaId}
                        onChange={(e) => void changeBrand(e.target.value ? Number(e.target.value) : null)}
                        aria-invalid={!!errors.oaBrandId}
                      >
                        <option value="">Select Brand</option>
                        {brands.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                      {fieldError('oaBrandId')}
                    </div>
                  )}
                  <div>
                    <label htmlFor="pc-user" className="mb-1 block text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                      Requested By
                    </label>
                    <select
                      id="pc-user"
                      className={selectCls}
                      value={userId ?? ''}
                      disabled={busy || !oaBrandId}
                      onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
                      aria-invalid={!!errors.userId}
                    >
                      <option value="">Select User</option>
                      {requestedByUsers.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    {fieldError('userId')}
                  </div>
                </div>
              )}

              {/* Permission Class (CI setAutocompleteControl) */}
              <div className="relative max-w-xl">
                <label htmlFor="pc-name" className="mb-1 block text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                  Permission Class <span className="text-rose-700 dark:text-rose-300">*</span>
                </label>
                <Input
                  id="pc-name"
                  value={className}
                  disabled={busy}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="pc-name-suggestions"
                  aria-autocomplete="list"
                  aria-invalid={!!errors.permissionClassName}
                  onChange={(e) => {
                    setClassName(e.target.value);
                    setPickedClassId(null); // CI: typing a new name clears permission_class_ID
                    setShowSuggestions(true);
                    setActiveSuggestion(-1);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (!showSuggestions || suggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveSuggestion((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
                      e.preventDefault();
                      void pickClass(suggestions[activeSuggestion]);
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                />
                {pickedClassId && <p className="mt-1 text-xs text-[#535768] dark:text-[#aab3c5]">Existing class #{pickedClassId} — saving replaces its permissions.</p>}
                {fieldError('permissionClassName')}
                {showSuggestions && suggestions.length > 0 && className.trim() && (
                  <ul
                    id="pc-name-suggestions"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] py-1 shadow-lg"
                  >
                    {suggestions.map((s, i) => (
                      <li
                        key={s.value}
                        role="option"
                        aria-selected={i === activeSuggestion}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          void pickClass(s);
                        }}
                        className={`cursor-pointer px-3 py-1.5 text-sm ${i === activeSuggestion ? 'bg-[#e3edf9] dark:bg-[#16233d] text-[#083f72] dark:text-[#cfe1fa]' : 'text-[#1a1818] dark:text-[#e6e9f0] hover:bg-[#f6f7f9] dark:hover:bg-white/5'}`}
                      >
                        {s.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* CI setCheckboxControl "Access Write" (permissions[], SYSTEMPERMISSIONTYPE masters) */}
              {init.accessOptions.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">Access Write</legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {init.accessOptions.map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-[#1a1818] dark:text-[#e6e9f0]">
                        <input
                          type="checkbox"
                          checked={accessPermissions.includes(opt.value)}
                          disabled={busy}
                          onChange={(e) =>
                            setAccessPermissions((ids) =>
                              e.target.checked ? [...ids, opt.value] : ids.filter((id) => id !== opt.value),
                            )
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Ref Type tabs */}
              <div>
                <p className="mb-2 text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                  Ref Type <span className="text-rose-700 dark:text-rose-300">*</span>
                </p>
                <div role="tablist" aria-label="Ref Type" className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-white/10">
                  {TABS.map((t) => {
                    const count =
                      t.key === 'user' ? users.length : t.key === 'userGroup' ? userGroups.length : t.key === 'role' ? roles.length : null;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        id={`pc-tab-${t.key}`}
                        aria-selected={tab === t.key}
                        aria-controls={`pc-panel-${t.key}`}
                        onClick={() => setTab(t.key)}
                        className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${
                          tab === t.key ? 'border-[#e15425] text-[#0b5394] dark:text-[#8cb8f0]' : 'border-transparent text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white'
                        }`}
                      >
                        <User className="h-4 w-4" aria-hidden="true" />
                        {t.label}
                        {count !== null && count > 0 && <span className="rounded-full bg-[#f1f3f8] dark:bg-white/10 px-1.5 text-xs text-[#323338] dark:text-[#d5dae4]">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4">
                  <div role="tabpanel" id="pc-panel-user" aria-labelledby="pc-tab-user" hidden={tab !== 'user'}>
                    <DualListBox label="Users" options={options.users} selected={users} onChange={setUsers} disabled={busy} />
                    {fieldError('users')}
                  </div>
                  <div role="tabpanel" id="pc-panel-userGroup" aria-labelledby="pc-tab-userGroup" hidden={tab !== 'userGroup'}>
                    <DualListBox label="User Groups" options={options.userGroups} selected={userGroups} onChange={setUserGroups} disabled={busy} />
                  </div>
                  <div role="tabpanel" id="pc-panel-role" aria-labelledby="pc-tab-role" hidden={tab !== 'role'}>
                    <DualListBox label="Roles" options={options.roles} selected={roles} onChange={setRoles} disabled={busy} />
                  </div>
                  <div role="tabpanel" id="pc-panel-function" aria-labelledby="pc-tab-function" hidden={tab !== 'function'}>
                    <FunctionTree modules={init.modules} state={tree} onChange={setTree} disabled={busy} />
                  </div>
                </div>
              </div>

              {errors.form && (
                <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">
                  {errors.form}
                </p>
              )}
            </>
          )}

          {/* Footer — same design as DynamicForm */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
            <Button
              type="submit"
              disabled={busy}
              className="rounded-full !bg-none !bg-[#e15425] hover:!bg-[#c2431c] text-white px-6 h-10 text-sm font-semibold shadow-md shadow-[#e15425]/25 dark:shadow-black/30 border-0"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={cancel} className="rounded-full border-slate-200 dark:border-white/10 text-[#1a1818] dark:text-[#e6e9f0] hover:bg-[#f6f7f9] dark:hover:bg-white/5 px-6 h-10 text-sm font-semibold shadow-sm">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
