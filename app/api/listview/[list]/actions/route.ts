import { readQuery, withApi } from '@/lib/http/withApi';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import { getListDefinition, type ResolvedListAction } from '@/lib/listview/listDefinitions';

/**
 * GET /api/listview/{list}/actions?{page query} — the definition's configured `listActions`
 * (CI $listActions) the caller may see: admin level, policy grant and the action's own condition
 * are checked here, dialog select options are resolved, and the `ref` documentation is dropped.
 * The endpoints the actions call enforce the same rules again.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ list: string }>(async ({ req, params, subject }) => {
  const def = getListDefinition(params.list);
  if (!def) throw new NotFoundError('Unknown list.');
  if (!(await def.policy.check(subject, 'list'))) throw new ForbiddenError('You do not have permission to view this list.');
  const query = readQuery(req);

  // Each action resolves on its own: a failing condition hides only that action, a failing option
  // lookup (e.g. a view not yet created) leaves only that dropdown empty — never all the buttons.
  const resolved = await Promise.all(
    (def.listActions ?? []).map(async (action): Promise<ResolvedListAction | null> => {
      try {
        if (subject.adminLevel < (action.minAdminLevel ?? 0)) return null;
        if (action.permission && !(await def.policy.check(subject, action.permission))) return null;
        if (action.visible && !(await action.visible(subject, query))) return null;
      } catch (e) {
        console.error(`[listview] ${params.list} action '${action.key}': visibility check failed`, e);
        return null;
      }
      const { visible: _visible, ref: _ref, permission: _permission, minAdminLevel: _level, dialog, ...rest } = action;
      if (!dialog) return rest;
      const fields = await Promise.all(
        dialog.fields.map(async ({ options, ...field }) => {
          if (!options) return field;
          try {
            return { ...field, options: (await options(subject)).map((o) => ({ value: String(o.value), label: o.label })) };
          } catch (e) {
            console.error(`[listview] ${params.list} action '${action.key}': options of '${field.name}' failed`, e);
            return { ...field, options: [] };
          }
        }),
      );
      return { ...rest, dialog: { ...dialog, fields } };
    }),
  );
  return resolved.filter((a): a is ResolvedListAction => a !== null);
});
