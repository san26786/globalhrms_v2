/**
 * Phase 15 — Dynamic Sidebar/Menu
 *
 * getModuleIcon(name) — the lookup Sidebar.tsx already imports from
 * '@/lib/menu/iconMap'. Maps a module's display name to a lucide-react
 * icon + Tailwind color class for the new UI.
 *
 * This is independent from menu_config.SMALL_VIEW_ICON (the legacy
 * uploaded icon file path, exposed on MenuNode.smallViewIcon) — that field
 * is preserved on the menu tree in case you want to render the org's
 * actual uploaded icons later instead of/alongside these.
 *
 * Matching is first-regex-wins against the module name. Add new rules as
 * new top-level modules show up in menu_config; anything unmatched falls
 * back to a generic folder icon rather than breaking the sidebar.
 */

import {
  LayoutDashboard,
  Users,
  UserPlus,
  Clock,
  Calendar,
  Wallet,
  DollarSign,
  BarChart3,
  GraduationCap,
  HeartPulse,
  FileText,
  Bell,
  Settings,
  Shield,
  Building2,
  Award,
  ClipboardList,
  Briefcase,
  Folder,
  type LucideIcon,
} from 'lucide-react';

export interface ModuleIconConfig {
  icon: LucideIcon;
  color: string;
}

const ICON_RULES: Array<[RegExp, ModuleIconConfig]> = [
  [/dashboard/i, { icon: LayoutDashboard, color: 'text-blue-500' }],
  [/employee/i, { icon: Users, color: 'text-emerald-500' }],
  [/recruit|applicant|candidate|job/i, { icon: UserPlus, color: 'text-purple-500' }],
  [/attendance|punch|time\s?sheet/i, { icon: Clock, color: 'text-amber-500' }],
  [/leave|vacation/i, { icon: Calendar, color: 'text-rose-500' }],
  [/payroll|salary|payment|loan/i, { icon: Wallet, color: 'text-green-600' }],
  [/finance|billing|invoice/i, { icon: DollarSign, color: 'text-teal-600' }],
  [/performance|review|appraisal/i, { icon: BarChart3, color: 'text-indigo-500' }],
  [/training|skill|learning/i, { icon: GraduationCap, color: 'text-cyan-600' }],
  [/benefit|wellness|health/i, { icon: HeartPulse, color: 'text-pink-500' }],
  [/report/i, { icon: FileText, color: 'text-slate-500' }],
  [/notification|announcement|alert/i, { icon: Bell, color: 'text-orange-500' }],
  [/permission|role|security|authority/i, { icon: Shield, color: 'text-red-500' }],
  [/organi[sz]ation|company|brand|officer|partner/i, { icon: Building2, color: 'text-blue-600' }],
  [/award|achievement/i, { icon: Award, color: 'text-yellow-500' }],
  [/project|task|ticket/i, { icon: ClipboardList, color: 'text-violet-500' }],
  [/utilit/i, { icon: Briefcase, color: 'text-gray-500' }],
  [/setting|config|master|admin|manager/i, { icon: Settings, color: 'text-slate-600' }],
];

const DEFAULT_ICON: ModuleIconConfig = { icon: Folder, color: 'text-slate-400' };

export function getModuleIcon(moduleName: string): ModuleIconConfig {
  for (const [pattern, config] of ICON_RULES) {
    if (pattern.test(moduleName)) {
      return config;
    }
  }
  return DEFAULT_ICON;
}