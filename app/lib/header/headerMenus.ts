/**
 * Data-driven replacement for the is_admin if-chains in header_v.php's
 * profile and settings dropdowns. One row per menu item, with a `visible`
 * predicate instead of nested <?php if ?> blocks.
 *
 * `href` values keep the CI controller/method segments. If your Next route
 * folders are named differently, this is the only file to change.
 */
import {
  Building2, Boxes, Calendar, Compass, Database, Eye, FileText, Handshake, HelpCircle,
  Key, Layers, ListTree, Menu, Network, Settings2, ShieldCheck, Sliders,
  SlidersHorizontal, User, UserCog, Users,
  type LucideIcon,
} from 'lucide-react';
import { isAdminOrAbove, isSuperAdmin, type HeaderSession } from './headerSession';

export interface HeaderMenuItem {
  key: string;
  label: string;
  desc?: string;
  icon: LucideIcon;
  href: (s: HeaderSession) => string;
  /** Omit = always visible. */
  visible?: (s: HeaderSession) => boolean;
}

export const visibleMenuItems = (items: HeaderMenuItem[], s: HeaderSession) =>
  items.filter((i) => !i.visible || i.visible(s));

/* ------------------------------ Profile dropdown ------------------------------ */

export const PROFILE_MENU: HeaderMenuItem[] = [
  { key: 'profile', label: 'Profile', desc: 'Manage your personal details', icon: User, href: () => '/user/profile' },
  { key: 'username', label: 'Update Username', desc: 'Change your account username', icon: Key, href: () => '/user/changeusername' },
  { key: 'password', label: 'Update Password', desc: 'Secure your login credentials', icon: Key, href: () => '/user/changepassword' },
  { key: 'security', label: 'Update Security Questions', desc: 'Configure safety checkpoints', icon: ShieldCheck, href: () => '/user/security_questions' },
  { key: 'last-login', label: 'View Last Login Details', desc: 'IP addresses and logging times', icon: Eye, href: () => '/systmInfoMgr/user_lst_login/LastLoginDetails' },
  {
    key: 'accounts',
    label: 'View Accounts Details',
    desc: 'Access codes & sub-accounts',
    icon: FileText,
    visible: isAdminOrAbove,
    // Super admin sees the list; a brand admin goes straight to their own account.
    href: (s) => (isSuperAdmin(s) ? '/systmMngt/org_accounts' : `/systmMngt/org_accounts/editOrgAccounts/${s.oaId ?? ''}`),
  },
  { key: 'company', label: 'View Company Info', desc: 'Linked branches & VAT details', icon: Building2, visible: isAdminOrAbove, href: () => '/systmMngt/oa_brands' },
  {
    key: 'officers',
    label: 'View Officers Info',
    desc: 'Company officers',
    icon: Users,
    visible: (s) => isSuperAdmin(s) && s.application === 'APPBA',
    href: () => '/company_officers/company_officers',
  },
  { key: 'partners', label: 'View Partners', desc: 'Partner organisations', icon: Handshake, visible: isSuperAdmin, href: () => '/partners/partners' },
  { key: 'permissions', label: 'View My Permissions', desc: 'Role privileges mapping', icon: ShieldCheck, visible: isAdminOrAbove, href: () => '/user/permission_class' },
];

/* ------------------------- Settings launcher (admin only) ------------------------ */
// The whole settings menu is hidden for employees (is_admin == 0) by the caller.
// NOT ported: "Change Density" — its href is "#" in the CI source (dead link).

export const SETTINGS_MENU: HeaderMenuItem[] = [
  { key: 'welcome-tour', label: 'Welcome Tour', icon: Compass, visible: (s) => s.application === 'APPIMS', href: () => '/welcome_tour/welcome_tour' },
  { key: 'user-settings', label: 'User Settings', icon: Users, href: () => '/user/user_master' },
  { key: 'brand-settings', label: 'Brand Settings', icon: Building2, href: () => '/setting_manager/change_module_settings/index/0/0/0/CS' },
  { key: 'module-settings', label: 'Module Settings', icon: Layers, href: () => '/setting_manager/change_module_settings' },
  { key: 'system-entity', label: 'System Entity', icon: Database, visible: isSuperAdmin, href: () => '/common/common_type/' },
  { key: 'masters', label: 'Masters', icon: ListTree, href: () => '/common/common_type/Masters' },
  { key: 'module-manager', label: 'Module Manager', icon: Boxes, visible: isSuperAdmin, href: () => '/hrchyMngt/manager' },
  { key: 'hierarchy-type', label: 'Hierarchy Type', icon: Network, visible: isSuperAdmin, href: () => '/hrchyMngt/hier_typ' },
  { key: 'period-manager', label: 'Period Manager', icon: Calendar, href: () => '/periodMngt/period_mst' },
  {
    key: 'menu-item-config',
    label: 'Menu Item Config',
    icon: SlidersHorizontal,
    visible: (s) => isSuperAdmin(s) && s.menuConfigId != null,
    href: (s) => `/common/config_mapping_dtl/index/${s.menuConfigId}`,
  },
  {
    key: 'gs-item-config',
    label: 'GS Item Config',
    icon: Sliders,
    visible: (s) => isSuperAdmin(s) && s.globalSettingsConfigId != null,
    href: (s) => `/common/config_mapping_dtl/index/${s.globalSettingsConfigId}`,
  },
  { key: 'menu-manager', label: 'Menu Manager', icon: Menu, visible: isSuperAdmin, href: () => '/menumanager/menumanager/' },
  {
    key: 'advance-setting',
    label: 'Advance Setting',
    icon: Settings2,
    visible: (s) => s.advanceSettingMenuId != null,
    href: (s) => `/dashboard/dashboard/ChildMenu/${s.advanceSettingMenuId}`,
  },
  { key: 'authority-level', label: 'Authority Level Setting', icon: ShieldCheck, href: () => '/authoritylevel/authoritylevel/' },
  { key: 'user-type-role', label: 'User Type Role Mapping', icon: UserCog, visible: isSuperAdmin, href: () => '/user/user_type_role_mapping' },
  {
    key: 'support',
    label: 'Support Center',
    icon: HelpCircle,
    visible: (s) => s.helpMenuId != null,
    href: (s) => `/dashboard/dashboard/ChildMenu/${s.helpMenuId}`,
  },
];
