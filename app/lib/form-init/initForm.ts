// Generic equivalent of a CI controller's initForm($id, ...).
// Every module supplies a FormConfig; this function runs the shared flow:
// record -> scope -> lookups (parallel) -> derive.

export type Row = Record<string, any>;

export type InitArgs<Ctx, Params> = {
  id?: number | null;
  params: Params;      // e.g. { classID }
  ctx: Ctx;            // tenant/session context
};

export type FormConfig<Ctx = any, Params = any, Rec = any, Scope = any> = {
  titles: { add: string; edit: string };
  loadRecord?: (id: number) => Promise<Rec | null>;
  resolveScope?: (a: InitArgs<Ctx, Params> & { record: Rec | null }) => Promise<Scope>;
  // each key becomes a key in the response; all run in parallel
  lookups?: Record<
    string,
    (a: InitArgs<Ctx, Params> & { record: Rec | null; scope: Scope }) => Promise<any>
  >;
  // optional post-processing that needs several lookups together
  derive?: (
    lookups: Record<string, any>,
    a: InitArgs<Ctx, Params> & { record: Rec | null; scope: Scope }
  ) => Promise<Row> | Row;
};

export async function initForm<Ctx, Params, Rec, Scope>(
  config: FormConfig<Ctx, Params, Rec, Scope>,
  args: InitArgs<Ctx, Params>
) {
  const id = args.id ?? null;
  const record = id && config.loadRecord ? await config.loadRecord(id) : null;
  const scope = (config.resolveScope
    ? await config.resolveScope({ ...args, id, record })
    : {}) as Scope;

  const full = { ...args, id, record, scope };
  const keys = Object.keys(config.lookups ?? {});
  const values = await Promise.all(keys.map((k) => config.lookups![k](full)));
  const lookups = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  const derived = config.derive ? await config.derive(lookups, full) : {};

  return {
    title: id ? config.titles.edit : config.titles.add,
    actionMode: id ? "edit" : "add",
    id,
    record,
    scope,
    ...lookups,
    ...derived,
  };
}