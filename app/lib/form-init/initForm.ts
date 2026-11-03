// Generic equivalent of a CI controller's initForm($id, ...).
// Every module supplies a FormConfig; this function runs the shared flow:
// record -> scope -> lookups (parallel) -> derive -> fields / values / permissions / actions.
//
// CI initForm($id) loaded the record when $id was given, set $data['title'] / $data['actionMode'],
// filled the dropdown arrays, decided which inputs the caller sees (OrgDetailsView for the system
// admin, read-only keys on edit) and rendered formview_v. Here the same decisions produce one JSON
// payload that ResourceFormPage (initUrl) renders with the shared DynamicForm — a module only
// declares its configuration.

import { ForbiddenError } from "@/lib/http/errors";
import type { DynamicField, FieldRules, SelectOption } from "@/lib/form-builder/formTypes";
import { buildDefaultValues } from "@/lib/form-builder/utils/defaultValues";
import type { ZodType } from "zod";
import { entityForm, type EntitySpec, type EntitySubject } from "./entityFields";

/** Whether an object schema rejects `name` when it is missing (CI 'required' rule). */
function requiredBy(schema: ZodType | undefined): (name: string) => boolean {
  const shape = (schema as { shape?: Record<string, ZodType> } | undefined)?.shape;
  return (name) => !!shape?.[name] && !shape[name].safeParse(undefined).success;
}

export type Row = Record<string, any>;

export type FormMode = "add" | "edit";

export type InitArgs<Ctx, Params> = {
  id?: number | null;
  params: Params;      // e.g. { classID }
  ctx: Ctx;            // tenant/session context
};

/** What every config callback receives once the record and scope are known. */
export type InitState<Ctx, Params, Rec, Scope> = InitArgs<Ctx, Params> & {
  id: number | null;
  mode: FormMode;
  record: Rec | null;
  scope: Scope;
};

/** InitState plus the resolved lookups (for fields, defaults, values). */
export type ResolvedState<Ctx, Params, Rec, Scope> = InitState<Ctx, Params, Rec, Scope> & {
  lookups: Record<string, any>;
};

/** CI has_insert/modify/delete_permission for the screen. */
export interface FormPermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
}

/** Where the form is saved. */
export interface FormSubmit {
  url: string;
  method: "POST" | "PUT";
}

/**
 * Field declaration on the server. Same shape as the client DynamicField, plus:
 *   optionsFrom — take the options from a lookup of this config;
 *   modes       — only present in these modes (CI fields shown on add or edit only);
 *   when        — only present when the predicate holds (e.g. system admin only).
 * The server-only keys are stripped before the payload is sent.
 */
export type FieldSpec<S> = Omit<DynamicField, "errors" | "validation"> & {
  optionsFrom?: string;
  modes?: FormMode[];
  when?: (state: S) => boolean;
};

/** A list of field names: fixed, per mode, or computed. */
export type FieldNameRule<S> = string[] | Partial<Record<FormMode, string[]>> | ((state: S) => string[]);

export type FormConfig<Ctx = any, Params = any, Rec = any, Scope = any> = {
  titles: { add: string; edit: string };
  loadRecord?: (id: number, args: InitArgs<Ctx, Params>) => Promise<Rec | null>;
  resolveScope?: (a: InitArgs<Ctx, Params> & { record: Rec | null }) => Promise<Scope>;
  // each key becomes a key of `lookups` in the response; all run in parallel
  lookups?: Record<string, (a: InitState<Ctx, Params, Rec, Scope>) => Promise<any>>;
  // optional post-processing that needs several lookups together
  derive?: (lookups: Record<string, any>, a: InitState<Ctx, Params, Rec, Scope>) => Promise<Row> | Row;

  /**
   * Database-driven inputs (CI getColDetails): the entity's columns with label, control type,
   * required, visibility, size and value all taken from the entity metadata and the record — see
   * entityFields.ts. Rendered before `fields`; a lookup named after a column becomes its options.
   * Needs a ctx with `adminLevel` / `oaBrandId` (the request subject).
   */
  entity?: EntitySpec;
  /**
   * The save endpoint's input schema (CI form_validation), per mode: an entity input is required
   * when its column is NOT NULL or the schema rejects it missing — CI getColDetails' $required.
   */
  schema?: Partial<Record<FormMode, ZodType | undefined>>;

  /** Extra inputs the metadata cannot describe (CI formview_v field list). */
  fields?: FieldSpec<ResolvedState<Ctx, Params, Rec, Scope>>[];
  /** Add-mode values (and fallbacks for edit). */
  defaults?: Row | ((s: ResolvedState<Ctx, Params, Rec, Scope>) => Row);
  /** Existing record → form values (edit mode). Defaults to the record as-is. */
  toValues?: (record: Rec, s: ResolvedState<Ctx, Params, Rec, Scope>) => Row;
  /** Not rendered, value still submitted (CI form_hidden). */
  hiddenFields?: FieldNameRule<ResolvedState<Ctx, Params, Rec, Scope>>;
  /** Rendered but not editable (CI readonly inputs, e.g. keys on edit). */
  readonlyFields?: FieldNameRule<ResolvedState<Ctx, Params, Rec, Scope>>;
  /** Browser-side validation per field (the API remains authoritative). */
  validation?: Record<string, FieldRules>;
  /**
   * Screen permissions. Add mode without `create` is refused (CI access denied); edit mode
   * without `update` returns a read-only form with `canSubmit: false`.
   */
  permissions?: (a: InitState<Ctx, Params, Rec, Scope>) => Promise<FormPermissions>;
  /** Save endpoint: `apiPath` gives POST apiPath / PUT apiPath/{id}; `submit` overrides it. */
  actions?: {
    apiPath?: string;
    submit?: (s: ResolvedState<Ctx, Params, Rec, Scope>) => FormSubmit;
  };
};

/** The JSON an init endpoint returns — everything a form page needs to render and save. */
export interface FormInitPayload<Rec = unknown, Scope = unknown> {
  title: string;
  mode: FormMode;
  /** CI $data['actionMode'] — same as `mode`. */
  actionMode: FormMode;
  id: number | null;
  fields: DynamicField[];
  /** Values to load into the form: defaults in add mode, the record's values in edit mode. */
  values: Row;
  /** What "Save and Add" resets to. */
  defaults: Row;
  permissions: FormPermissions;
  canSubmit: boolean;
  submit: FormSubmit | null;
  record: Rec | null;
  scope: Scope;
  lookups: Record<string, any>;
  extra: Row;
}

const ALL_PERMISSIONS: FormPermissions = { create: true, update: true, delete: true };

function namesFor<S extends { mode: FormMode }>(rule: FieldNameRule<S> | undefined, state: S): Set<string> {
  if (!rule) return new Set();
  if (typeof rule === "function") return new Set(rule(state));
  if (Array.isArray(rule)) return new Set(rule);
  return new Set(rule[state.mode] ?? []);
}

function resolveFields<S extends { mode: FormMode; lookups: Record<string, any> }>(
  specs: FieldSpec<S>[],
  state: S,
  hidden: Set<string>,
  readonly: Set<string>,
  validation: Record<string, FieldRules>,
  locked: boolean,
): DynamicField[] {
  return specs
    .filter((f) => (!f.modes || f.modes.includes(state.mode)) && (!f.when || f.when(state)))
    .map(({ optionsFrom, modes: _modes, when: _when, ...field }) => {
      const options: SelectOption[] | undefined = optionsFrom ? (state.lookups[optionsFrom] ?? []) : field.options;
      const rules = validation[field.name] ? { ...field.rules, ...validation[field.name] } : field.rules;
      return {
        ...field,
        ...(options ? { options } : {}),
        ...(rules ? { rules } : {}),
        ...(hidden.has(field.name) ? { hidden: true } : {}),
        ...(locked || readonly.has(field.name) ? { readOnly: true } : {}),
      };
    });
}

export async function initForm<Ctx, Params, Rec, Scope>(
  config: FormConfig<Ctx, Params, Rec, Scope>,
  args: InitArgs<Ctx, Params>
): Promise<FormInitPayload<Rec, Scope>> {
  const id = args.id ?? null;
  const mode: FormMode = id ? "edit" : "add";
  const record = id && config.loadRecord ? await config.loadRecord(id, args) : null;
  const scope = (config.resolveScope
    ? await config.resolveScope({ ...args, id, record })
    : {}) as Scope;

  const full: InitState<Ctx, Params, Rec, Scope> = { ...args, id, mode, record, scope };

  const [permissions, lookups] = await Promise.all([
    config.permissions ? config.permissions(full) : ALL_PERMISSIONS,
    (async () => {
      const keys = Object.keys(config.lookups ?? {});
      const values = await Promise.all(keys.map((k) => config.lookups![k](full)));
      return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    })(),
  ]);
  if (mode === "add" && !permissions.create) throw new ForbiddenError();
  const canSubmit = mode === "add" ? permissions.create : permissions.update;

  const extra = config.derive ? await config.derive(lookups, full) : {};
  const state: ResolvedState<Ctx, Params, Rec, Scope> = { ...full, lookups };

  const entity = config.entity
    ? await entityForm(config.entity, args.ctx as unknown as EntitySubject, id, requiredBy(config.schema?.[mode]))
    : null;
  const entitySpecs: FieldSpec<typeof state>[] = (entity?.fields ?? []).map((f) =>
    lookups[f.name] ? { ...f, type: "select", optionsFrom: f.name } : f,
  );

  const fields = resolveFields(
    [...entitySpecs, ...(config.fields ?? [])],
    state,
    namesFor(config.hiddenFields, state),
    namesFor(config.readonlyFields, state),
    config.validation ?? {},
    !canSubmit,
  );

  const explicitDefaults = typeof config.defaults === "function" ? config.defaults(state) : (config.defaults ?? {});
  // Field defaults / type fallbacks first, then the module's defaults.
  const defaults = { ...buildDefaultValues(fields), ...explicitDefaults };
  const recordValues = record
    ? (config.toValues ? config.toValues(record, state) : entity ? entity.values : (record as Row))
    : {};
  const values = { ...defaults, ...recordValues };

  const submit = config.actions?.submit
    ? config.actions.submit(state)
    : config.actions?.apiPath
      ? { url: id ? `${config.actions.apiPath}/${id}` : config.actions.apiPath, method: id ? ("PUT" as const) : ("POST" as const) }
      : null;

  return {
    title: id ? config.titles.edit : config.titles.add,
    mode,
    actionMode: mode,
    id,
    fields,
    values,
    defaults,
    permissions,
    canSubmit,
    submit,
    record,
    scope,
    lookups,
    extra,
  };
}