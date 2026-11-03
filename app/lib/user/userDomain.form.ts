import type { RequestSubject } from '@/lib/auth/getSubject';
import type { FormConfig } from '@/lib/form-init/initForm';
import { resourceForm } from '@/lib/form-init/initRoute';
import { userDomainService, type UserDomainDto } from './userDomain.resource';

/**
 * User Domain form — CI user/user_domain::initForm($id). The inputs (Domain Name, Description) and
 * the system admin's Organisation / Brand come from the user_domain entity metadata, exactly as CI's
 * getColDetails('user_domain', …) and OrgDetailsView resolved them.
 */
export const userDomainForm: FormConfig<RequestSubject, Record<string, never>, UserDomainDto> = {
  titles: { add: 'New User Domain', edit: 'Edit User Domain' },
  ...resourceForm(userDomainService, '/api/user/user_domain'),
  entity: { table: 'user_domain' },
};
