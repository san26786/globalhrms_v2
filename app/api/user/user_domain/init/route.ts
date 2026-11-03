import { initRoute } from '@/lib/form-init/initRoute';
import { userDomainForm } from '@/lib/user/userDomain.form';

/** GET ?id= — CI user/user_domain::initForm($id): fields, values, permissions, save action. */
export const dynamic = 'force-dynamic';

export const { GET } = initRoute(userDomainForm);
