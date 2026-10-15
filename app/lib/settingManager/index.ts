import { menuPolicy } from '@/lib/resource/policies';
import { invalidateBrandContext } from '@/lib/session/brandContext';
import type { RequestSubject } from '@/lib/auth/getSubject';
import { PrismaModuleSettingsRepository } from './moduleSettings.repository';
import { ModuleSettingsService } from './moduleSettings.service';
import type { SettingsAccess, SettingsActor, SettingsCache } from './moduleSettings.types';

/**
 * Composition root of the settings module (the project has no global container): the only place
 * that knows the concrete classes. Routes import `moduleSettingsService`; tests construct
 * ModuleSettingsService with their own fakes.
 */

// CI checked nothing on the server, and header_v linked Settings → Brand Settings / Module Settings
// for EVERY admin (is_admin != 0), whatever their menu grants. So: admins may view / save (sync is
// further limited to brand admins by the service); normal users need the permission_dtl FUNCTION
// grant of the menu item (menu URLs all start with this prefix).
const policy = menuPolicy('setting_manager/change_module_settings');
const ACTION = { view: 'list', save: 'update', sync: 'update' } as const;

const access: SettingsAccess = {
  can: async (actor: SettingsActor, action) =>
    actor.adminLevel !== 0 || policy.check(actor as RequestSubject, ACTION[action]),
};

const cache: SettingsCache = { invalidateBrand: invalidateBrandContext };

const repository = new PrismaModuleSettingsRepository();

export const moduleSettingsService = new ModuleSettingsService(repository, repository, access, cache);
