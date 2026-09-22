import type { AppSession } from '../domain/session/AppSession';

export interface SettingsMenuItem {
  label: string;
  href: (session: AppSession) => string;
  /** true if this item should render for the given session. */
  visible: (session: AppSession) => boolean;
}

/**
 * Ported from the Settings dropdown's <?php if ... ?> chain in header.php.
 * Each row below corresponds 1:1 to one <a class="dropdown-item"> there —
 * kept as a flat list rather than nested conditionals so adding/removing
 * an item doesn't require touching JSX.
 */
export const settingsMenuItems: SettingsMenuItem[] = [
  {
    label: 'Welcome Tour',
    href: () => '/welcome-tour',
    visible: (s) => s.application === 'APPIMS',
  },
  {
    label: 'User Settings',
    href: () => '/user/user-master',
    visible: () => true, // rendered whenever the Settings menu itself is (is_admin != 0)
  },
  {
    label: 'Brand Settings',
    href: () => '/settings/module-settings?scope=brand',
    visible: (s) => s.isAdmin !== 0,
  },
  {
    label: 'Module Settings',
    href: () => '/settings/module-settings',
    visible: (s) => s.isAdmin !== 0,
  },
  {
    label: 'System Entity',
    href: () => '/common/common-type',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Masters',
    href: () => '/common/common-type/masters',
    visible: () => true,
  },
  {
    label: 'Module Manager',
    href: () => '/hierarchy/manager',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Hierarchy Type',
    href: () => '/hierarchy/type',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Period Manager',
    href: () => '/period/period-master',
    visible: () => true,
  },
  {
    label: 'Menu Item Config',
    href: () => '/common/config-mapping-dtl?type=menu',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'GS Item Config',
    href: () => '/common/config-mapping-dtl?type=global-settings',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Menu Manager',
    href: () => '/menu-manager',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Advance Setting',
    href: (s) => `/dashboard/child-menu/${s.advanceSettingMenuId ?? ''}`,
    visible: () => true,
  },
  {
    label: 'Authority Level Setting',
    href: () => '/authority-level',
    visible: () => true,
  },
  {
    label: 'User Type Role Mapping',
    href: () => '/user/user-type-role-mapping',
    visible: (s) => s.isAdmin === 2,
  },
  {
    label: 'Support Center',
    href: (s) => `/dashboard/child-menu/${s.helpMenuId ?? ''}`,
    visible: () => true,
  },
];
