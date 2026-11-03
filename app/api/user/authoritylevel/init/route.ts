import { initRoute } from '@/lib/form-init/initRoute';
import { authorityLevelForm } from '@/lib/user/authorityLevel.form';

/** GET ?id= — CI authoritylevel/authoritylevel::initForm($id): fields, values, permissions, save action. */
export const dynamic = 'force-dynamic';

export const { GET } = initRoute(authorityLevelForm);
