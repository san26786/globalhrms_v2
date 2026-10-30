import { readQuery, withApi } from '@/lib/http/withApi';
import { benefitRulesService as svc } from '@/lib/benefitrules/benefitRules';

/** CI benefitrules/benefitrules initForm — GET ?type=… (add) or ?id=… (edit: the record's own type) → title + dropdown options. */
export const GET = withApi(async ({ req, subject }) => svc.form(subject, readQuery(req)));
