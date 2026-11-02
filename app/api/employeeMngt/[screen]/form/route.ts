import { readQuery, withApi } from '@/lib/http/withApi';
import { hubFor } from '@/lib/employeeMngt/hub/registry';

/** Employee Hub record screens — the add / edit form's employees and dropdown lists (CI initForm); ?id = the record being edited. */
export const GET = withApi<{ screen: string }>(async ({ req, params, subject }) => hubFor(params.screen).form(subject, readQuery(req).id || undefined));
