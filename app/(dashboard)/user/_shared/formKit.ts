"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/authFetch";
import type { DynamicField, SelectOption } from "@/lib/form-builder/formTypes";

/**
 * Small helpers shared by the user-administration forms.
 *
 * Multi-selects (CI `multiple` dropdowns: user roles, group members) are rendered with the shared
 * DynamicForm as one checkbox per option inside a titled section — DynamicForm has no multi-select
 * field type yet. Values live under `<prefix><id>` keys and are converted to/from id arrays here.
 */
export type FlagValues = Record<string, unknown>;

export function checkboxGroup(prefix: string, section: string, options: SelectOption[], required = false): DynamicField[] {
  return options.map(
    (o, index) =>
      ({
        name: `${prefix}${o.value}`,
        label: o.label,
        type: "checkbox",
        section: required ? `${section} *` : section,
        colSpan: 4,
        order: 1000 + index,
      }) as DynamicField,
  );
}

export function idsToFlags(prefix: string, ids: number[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [`${prefix}${id}`, true]));
}

export function flagsToIds(prefix: string, values: FlagValues): number[] {
  return Object.entries(values)
    .filter(([key, checked]) => key.startsWith(prefix) && checked === true)
    .map(([key]) => Number(key.slice(prefix.length)))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** Removes the `<prefix><id>` keys from a payload. */
export function withoutFlags<T extends FlagValues>(prefix: string, values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith(prefix))) as Partial<T>;
}

export interface UserAdminMeta {
  adminLevel: 0 | 1 | 2;
  userId: number;
  canCreate: boolean;
  canUpdate: boolean;
  canChangeStatus: boolean;
  canSetAdmin: boolean;
}

/** Caller capabilities (admin level etc.) — decides e.g. whether the sysadmin-only Brand selector is shown. */
export function useUserAdminMeta(): UserAdminMeta | null {
  const [meta, setMeta] = useState<UserAdminMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    authFetch("/api/user/user_master/meta")
      .then((res) => res.json())
      .then((json) => !cancelled && json.success && setMeta(json.data as UserAdminMeta))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return meta;
}

export const idOrEmpty = (v: number | null | undefined) => (v ? String(v) : "");
export const emptyToUndefined = (v: string) => (v ? v : undefined);
