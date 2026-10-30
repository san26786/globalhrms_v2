'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import GlobalHRLogo from '@/components/auth/GlobalHRLogo';
import { getModuleIcon } from '@/lib/menu/iconMap';
import { useNavigation } from '@/lib/navigation/NavigationContext';
import type { MenuNode } from '@/lib/menu/types';
import { poppins } from '@/components/auth/AuthUi';
import { ThemeScope } from '@/components/dashboard/DashboardUi';

/**
 * Left menu — port of CI include/left_menu_v.php.
 *  - Data: the caller's permission-filtered menu (NavigationContext → /api/menu); every node
 *    carries its resolved Next link (lib/navigation/routeRegistry), so nothing is hardcoded here.
 *  - Expanded sidebar: inline accordion; opening a module closes its siblings (CI toggleInline).
 *  - Collapsed sidebar: flyout sub-menu on hover (CI showFlyout), kept on screen.
 *  - Active state follows the URL, so it survives refreshes, direct links and back/forward;
 *    the module containing the current page opens automatically.
 *  - A module whose URL has a page of its own navigates AND toggles, as the CI anchor did.
 *  - CI appended ?pid=PERMISSIONS_DTL_ID to child links, but the menu query never selected that
 *    column (always empty) — permission is re-evaluated server-side instead.
 */

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeBrand?: string;
}

const UNAVAILABLE_TITLE = 'This module has not been migrated to the new application yet.';

function hasChildren(node: MenuNode): boolean {
  return node.children.length > 0;
}

/** A leaf/sub-menu entry: internal link, external link, or a non-clickable placeholder row. */
function MenuEntry({
  node,
  className,
  activeClassName,
  inactiveClassName,
  active,
  onNavigate,
  children,
}: {
  node: MenuNode;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  active: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const link = node.link;
  const cls = `${className} ${active ? activeClassName : inactiveClassName}`;
  if (link.kind === 'internal') {
    return (
      <Link href={link.href} onClick={onNavigate} className={cls} title={node.name} aria-current={active ? 'page' : undefined}>
        {children}
      </Link>
    );
  }
  if (link.kind === 'external') {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls} title={node.name}>
        {children}
      </a>
    );
  }
  return (
    <span aria-disabled="true" className={`${className} ${inactiveClassName} opacity-50 cursor-not-allowed`} title={link.kind === 'unavailable' ? UNAVAILABLE_TITLE : node.name}>
      {children}
    </span>
  );
}

/** Sub-menu rows (level ≥ 1). Deeper levels nest as their own accordion. */
function SubMenu({ nodes, onNavigate, depth = 1 }: { nodes: MenuNode[]; onNavigate?: () => void; depth?: number }) {
  const { isActive } = useNavigation();
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <>
      {nodes.map((sub) => {
        const active = isActive(sub);
        if (!hasChildren(sub)) {
          return (
            <MenuEntry
              key={sub.id}
              node={sub}
              active={active}
              onNavigate={onNavigate}
              className="block w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 truncate"
              activeClassName="text-[#7a2e12] dark:text-[#f8d3c3] bg-[#fbe6dd] dark:bg-[#da5427]/15"
              inactiveClassName="text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white hover:bg-[#f6f7f9] dark:hover:bg-white/5 hover:translate-x-0.5"
            >
              {sub.name}
            </MenuEntry>
          );
        }
        const isOpen = open[sub.id] ?? active;
        return (
          <div key={sub.id}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [sub.id]: !isOpen }))}
              aria-expanded={isOpen}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                active ? 'text-[#7a2e12] dark:text-[#f8d3c3]' : 'text-[#535768] dark:text-[#aab3c5] hover:text-[#1a1818] dark:hover:text-white hover:bg-[#f6f7f9] dark:hover:bg-white/5'
              }`}
              title={sub.name}
            >
              <span className="truncate">{sub.name}</span>
              {isOpen ? <ChevronUp className="w-3 h-3 opacity-70 shrink-0" /> : <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />}
            </button>
            {isOpen && (
              <div className="ml-3 pl-2 border-l border-slate-200 dark:border-white/10 flex flex-col gap-0.5">
                <SubMenu nodes={sub.children} onNavigate={onNavigate} depth={depth + 1} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function Sidebar({ isCollapsed, onToggleCollapse, activeBrand }: SidebarProps) {
  const { menu, loading, error, reload, isActive, activeTrail } = useNavigation();

  // Accordion: one module open at a time. Until the user toggles, the module containing the
  // current page is open; a navigation into another module re-opens that one.
  const activeTopId = activeTrail[0]?.id ?? null;
  const [toggle, setToggle] = useState<{ forActive: number | null; expanded: number | null }>({ forActive: null, expanded: null });
  const expandedId = toggle.forActive === activeTopId ? toggle.expanded : activeTopId;
  const setExpanded = (id: number | null) => setToggle({ forActive: activeTopId, expanded: id });

  // Collapsed-mode flyout
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [hoverTop, setHoverTop] = useState(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  const openFlyout = (el: HTMLElement, id: number) => {
    clearHoverTimer();
    const rect = el.getBoundingClientRect();
    // Keep the flyout on screen (CI showFlyout flips/pins it): cap at 75vh and clamp the top.
    const maxHeight = window.innerHeight * 0.75;
    setHoverTop(Math.max(12, Math.min(rect.top, window.innerHeight - maxHeight - 12)));
    setHoverId(id);
  };
  const scheduleFlyoutClose = () => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => setHoverId(null), 150);
  };

  const flyoutNode = isCollapsed && hoverId !== null ? menu.find((m) => m.id === hoverId) ?? null : null;

  return (
    <ThemeScope contents>
    <aside
      className={`${poppins.className} bg-white dark:bg-[#111a2e] border-r border-slate-200 dark:border-white/10 flex flex-col h-screen fixed left-0 top-0 transition-all duration-300 z-50 ${
        isCollapsed ? 'w-24' : 'w-64'
      }`}
      aria-label="Main navigation"
    >
      {/* Brand Logo Container */}
      <div className={`${isCollapsed ? 'h-24 py-2' : 'h-20 px-4'} flex items-center justify-center border-b border-slate-50 dark:border-white/5 shrink-0 overflow-hidden`}>
        <Link href="/dashboard" title={activeBrand || 'Global HR'} className="flex items-center justify-center">
          {isCollapsed ? <GlobalHRLogo size="sm" stacked activeBrand={activeBrand} /> : <GlobalHRLogo size="md" activeBrand={activeBrand} />}
        </Link>
      </div>

      {/* Menu List Container */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-2 scrollbar-thin">
        {loading && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading menu">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="px-2 py-3 text-center">
            <p className="text-[12px] font-medium text-rose-800 mb-2">{isCollapsed ? 'Menu error' : error}</p>
            <button
              type="button"
              onClick={reload}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium text-[#323338] dark:text-[#d5dae4] border border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> {!isCollapsed && 'Retry'}
            </button>
          </div>
        )}

        {!loading && !error && menu.length === 0 && !isCollapsed && (
          <p className="px-3 py-4 text-[13px] text-[#535768] dark:text-[#aab3c5] text-center">No modules are assigned to your account.</p>
        )}

        {!loading &&
          !error &&
          menu.map((item) => {
            const { icon: Icon, color } = getModuleIcon(item.name);
            const active = isActive(item);
            const withChildren = hasChildren(item);
            const isExpanded = !isCollapsed && expandedId === item.id;

            const baseClass = isCollapsed
              ? 'w-full flex flex-col items-center justify-center text-center gap-1 py-3 px-1 rounded-xl text-[10.5px] font-medium tracking-normal transition-all duration-200 select-none group relative cursor-pointer'
              : 'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 select-none group relative cursor-pointer';
            const activeClass = 'bg-[#e15425] text-white shadow-[0_10px_22px_-12px_rgba(225,84,37,0.9)]';
            const inactiveClass = isCollapsed
              ? 'text-[#323338] dark:text-[#d5dae4] hover:bg-[#f6f7f9] dark:hover:bg-white/5 hover:text-[#1a1818] dark:hover:text-white'
              : 'text-[#323338] dark:text-[#d5dae4] hover:bg-[#f6f7f9] dark:hover:bg-white/5 hover:text-[#1a1818] dark:hover:text-white hover:translate-x-0.5';

            const content = (
              <>
                {active && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white/80" />}
                <div className={`flex min-w-0 ${isCollapsed ? 'flex-col items-center gap-1 w-full' : 'items-center gap-3.5'}`}>
                  <Icon
                    className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                      isCollapsed
                        ? active
                          ? 'w-7 h-7 text-white'
                          : `${color} w-7 h-7 group-hover:opacity-100`
                        : active
                          ? 'w-5 h-5 text-white'
                          : `${color} w-5 h-5 group-hover:opacity-80`
                    }`}
                  />
                  {isCollapsed ? (
                    <span className="text-[10.5px] leading-[1.15] font-medium mt-1 select-none tracking-tight whitespace-normal break-words w-full text-center block px-0.5">
                      {item.name}
                    </span>
                  ) : (
                    <span className="truncate">{item.name}</span>
                  )}
                </div>
                {!isCollapsed && withChildren && (
                  <div className="shrink-0 ml-1">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-70" /> : <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
                  </div>
                )}
              </>
            );

            const hoverHandlers = {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => isCollapsed && withChildren && openFlyout(e.currentTarget, item.id),
              onMouseLeave: () => isCollapsed && scheduleFlyoutClose(),
            };

            return (
              <div key={item.id} className="space-y-1" data-menu-id={`menu_${item.id}`}>
                {withChildren && item.link.kind !== 'internal' && item.link.kind !== 'external' ? (
                  // Module group ('#'): the row only opens its sub-menu.
                  <button
                    type="button"
                    id={`sidebar-item-${item.id}`}
                    onClick={(e) => (isCollapsed ? openFlyout(e.currentTarget, item.id) : setExpanded(isExpanded ? null : item.id))}
                    {...hoverHandlers}
                    title={isCollapsed ? item.name : undefined}
                    aria-haspopup="true"
                    aria-expanded={isCollapsed ? hoverId === item.id : isExpanded}
                    className={`${baseClass} ${active ? activeClass : inactiveClass}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div {...hoverHandlers} id={`sidebar-item-${item.id}`}>
                    <MenuEntry
                      node={item}
                      active={active}
                      onNavigate={() => withChildren && !isCollapsed && setExpanded(isExpanded ? null : item.id)}
                      className={baseClass}
                      activeClassName={activeClass}
                      inactiveClassName={inactiveClass}
                    >
                      {content}
                    </MenuEntry>
                  </div>
                )}

                {isExpanded && withChildren && (
                  <div className="mt-1 ml-6 pl-3 border-l border-slate-200 dark:border-white/10 flex flex-col gap-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-200" aria-label={`${item.name} sub-menu`}>
                    <SubMenu nodes={item.children} />
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Collapsed-mode flyout (outside the scrollable nav so it is not clipped) */}
      {flyoutNode && (
        <div
          style={{ top: `${hoverTop}px` }}
          onMouseEnter={clearHoverTimer}
          onMouseLeave={() => setHoverId(null)}
          role="menu"
          className="fixed left-[92px] ml-1 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_24px_50px_-20px_rgba(6,27,49,0.4)] py-2 w-64 z-50 text-left animate-in fade-in-0 slide-in-from-left-2 duration-200"
        >
          <div className="px-4 pb-2 mb-1 border-b border-slate-100 dark:border-white/10 text-[12px] font-medium uppercase tracking-wider text-[#535768] dark:text-[#aab3c5]">{flyoutNode.name}</div>
          <div className="max-h-[75vh] overflow-y-auto px-2 space-y-1 scrollbar-thin">
            {flyoutNode.children.map((sub) =>
              hasChildren(sub) ? (
                <div key={sub.id} className="px-2 py-1">
                  <p className="px-2 text-[11px] font-medium uppercase text-[#535768] dark:text-[#aab3c5]">{sub.name}</p>
                  <SubMenu nodes={sub.children} onNavigate={() => setHoverId(null)} />
                </div>
              ) : (
                <MenuEntry
                  key={sub.id}
                  node={sub}
                  active={isActive(sub)}
                  onNavigate={() => setHoverId(null)}
                  className="block w-full text-left px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
                  activeClassName="bg-[#e15425] text-white shadow-sm"
                  inactiveClassName="text-[#323338] dark:text-[#d5dae4] hover:bg-[#fbe6dd] dark:hover:bg-[#da5427]/15 hover:text-[#7a2e12] dark:hover:text-[#f8d3c3]"
                >
                  {sub.name}
                </MenuEntry>
              ),
            )}
          </div>
        </div>
      )}

      {/* Collapse Bottom Panel */}
      <div className="p-3 border-t border-slate-200 dark:border-white/10 shrink-0">
        <button
          id="sidebar-toggle-collapse"
          type="button"
          onClick={onToggleCollapse}
          aria-label="Toggle sidebar"
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[13px] font-medium text-[#323338] dark:text-[#d5dae4] hover:bg-[#f6f7f9] dark:hover:bg-white/5 hover:text-[#1a1818] dark:hover:text-white transition-all duration-200 border border-slate-200 dark:border-white/10 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-[#535768] dark:text-[#aab3c5]" /> : <ChevronLeft className="w-4 h-4 text-[#535768] dark:text-[#aab3c5]" />}
            {!isCollapsed && <span>Collapse</span>}
          </div>
          {!isCollapsed && <span className="text-[11px] text-[#535768] dark:text-[#aab3c5] font-mono">Ctrl/⌘B</span>}
        </button>
      </div>
    </aside>
    </ThemeScope>
  );
}
