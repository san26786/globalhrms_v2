import type { RequestSubject } from '@/lib/auth/getSubject';
import type { FormConfig } from '@/lib/form-init/initForm';
import { resourceForm } from '@/lib/form-init/initRoute';
import { lookupService } from '@/lib/lookups/lookupService';
import { AUTHORITY_LEVEL_TYPE_ID, authorityLevelService, type AuthorityLevelDto } from './authorityLevel.resource';

/**
 * Authority Level form — CI authoritylevel/authoritylevel::initForm($id). The inputs (Authority
 * Level, Authority Value) and the system admin's Organisation / Brand come from the
 * authority_level entity metadata (CI getColDetails('authority_level', …) and OrgDetailsView).
 * Only the dropdown's data set is given here, as CI passed getAllIndpMstData() (masters of type 40)
 * to setDropDownControlNew.
 */
export const authorityLevelForm: FormConfig<RequestSubject, Record<string, never>, AuthorityLevelDto> = {
  titles: { add: 'New Authority Level', edit: 'Edit Authority Level' },
  ...resourceForm(authorityLevelService, '/api/user/authoritylevel'),
  entity: { table: 'authority_level' },
  lookups: {
    AUTHORITY_LEVEL_ID: () => lookupService.masters(AUTHORITY_LEVEL_TYPE_ID),
  },
};
