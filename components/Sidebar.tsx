import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import GlobalHRLogo from './GlobalHRLogo';
import { modulesData } from '../data/modules';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeMenu: string;
  activeSubMenu?: string;
  onSelectMenu: (menu: string, subMenu?: string) => void;
  activeBrand?: string;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeMenu,
  activeSubMenu,
  onSelectMenu,
  activeBrand
}: SidebarProps) {
  // Keep track of which menu is expanded manually
  const [expandedMenu, setExpandedMenu] = useState<string | null>(activeMenu);

  // Sync expandedMenu with activeMenu if activeMenu changes from parent/elsewhere
  useEffect(() => {
    if (activeMenu) {
      setExpandedMenu(activeMenu);
    }
  }, [activeMenu]);

  // States for handling the floating sub-menu dropdown in collapsed mode
  const [activeHoverMenu, setActiveHoverMenu] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [hoverTimeout, setHoverTimeout] = useState<any>(null);

  const handleMenuClick = (menuName: string, subModules: string[]) => {
    if (isCollapsed) {
      // If collapsed, clicking selects the module and its first sub-module
      onSelectMenu(menuName, subModules[0]);
      return;
    }

    // Toggle expansion of submenu
    if (expandedMenu === menuName) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(menuName);
    }

    // Also trigger select menu with first submodule if any exists
    if (subModules && subModules.length > 0) {
      onSelectMenu(menuName, subModules[0]);
    } else {
      onSelectMenu(menuName);
    }
  };

  const handleMouseEnterButton = (e: React.MouseEvent<HTMLButtonElement>, itemName: string) => {
    if (!isCollapsed) return;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPosition(rect.top);
    setActiveHoverMenu(itemName);
  };

  const handleMouseLeaveButton = () => {
    if (!isCollapsed) return;
    const timeout = setTimeout(() => {
      setActiveHoverMenu(null);
    }, 150);
    setHoverTimeout(timeout);
  };

  const handleMouseEnterFlyout = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };

  const handleMouseLeaveFlyout = () => {
    setActiveHoverMenu(null);
  };

  const handleSubModuleClick = (menuName: string, subName: string) => {
    onSelectMenu(menuName, subName);
    setActiveHoverMenu(null);
  };

  return (
    <aside
      className={`bg-white border-r border-slate-100 flex flex-col h-screen fixed left-0 top-0 transition-all duration-300 z-50 ${
        isCollapsed ? 'w-24' : 'w-64'
      }`}
    >
      {/* Brand Logo Container */}
      <div className={`${isCollapsed ? 'h-24 py-2' : 'h-20 px-4'} flex items-center justify-center border-b border-slate-50 shrink-0 overflow-hidden`}>
        {isCollapsed ? (
          <GlobalHRLogo size="sm" stacked activeBrand={activeBrand} />
        ) : (
          <GlobalHRLogo size="md" activeBrand={activeBrand} />
        )}
      </div>

      {/* Menu List Container */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-2 scrollbar-thin">
        {modulesData.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.name;
          const isExpanded = !isCollapsed && expandedMenu === item.name;

          return (
            <div key={item.name} className="space-y-1">
              <button
                id={`sidebar-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleMenuClick(item.name, item.subModules || [])}
                onMouseEnter={(e) => handleMouseEnterButton(e, item.name)}
                onMouseLeave={handleMouseLeaveButton}
                title={isCollapsed ? item.name : undefined}
                className={
                  isCollapsed
                    ? `w-full flex flex-col items-center justify-center text-center gap-1 py-3 px-1 rounded-xl text-[10px] font-black tracking-normal transition-all duration-200 select-none group relative ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
                          : 'text-orange-600 hover:bg-orange-50/40 hover:text-orange-700'
                      }`
                    : `w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 select-none group relative ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`
                }
              >
                <div className={`flex min-w-0 ${isCollapsed ? 'flex-col items-center gap-1 w-full' : 'items-center gap-3.5'}`}>
                  <Icon
                    className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${
                      isCollapsed
                        ? isActive
                          ? 'w-7 h-7 text-white'
                          : `${item.color} w-7 h-7 group-hover:opacity-100`
                        : isActive
                          ? 'w-5 h-5 text-white'
                          : `${item.color} w-5 h-5 group-hover:opacity-80`
                    }`}
                  />
                  
                  {isCollapsed ? (
                    <span className="text-[9.5px] leading-[1.15] font-black mt-1 select-none tracking-tight whitespace-normal break-words w-full text-center block px-0.5">
                      {item.name}
                    </span>
                  ) : (
                    <span className="truncate tracking-wide">{item.name}</span>
                  )}
                </div>

                {/* Accordion indicator for expanded sub-menu */}
                {!isCollapsed && item.subModules && item.subModules.length > 0 && (
                  <div className="shrink-0 ml-1">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 opacity-70" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    )}
                  </div>
                )}
              </button>

              {/* Sub-modules List Accordion (for Expanded state) */}
              {!isCollapsed && isExpanded && item.subModules && item.subModules.length > 0 && (
                <div className="mt-1 ml-6 pl-3 border-l border-slate-100 flex flex-col gap-0.5 animate-fade-in">
                  {item.subModules.map((sub) => {
                    const isSubActive = activeSubMenu === sub;
                    return (
                      <button
                        key={sub}
                        onClick={() => onSelectMenu(item.name, sub)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all truncate ${
                          isSubActive
                            ? 'text-blue-600 bg-blue-50/50'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                        title={sub}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Fixed Floating flyout sub-menu for collapsed sidebar (rendered outside scrollable nav to prevent clip) */}
      {isCollapsed && activeHoverMenu && (
        (() => {
          const item = modulesData.find(m => m.name === activeHoverMenu);
          if (!item || !item.subModules || item.subModules.length === 0) return null;
          return (
            <div
              style={{ top: `${hoverPosition}px` }}
              onMouseEnter={handleMouseEnterFlyout}
              onMouseLeave={handleMouseLeaveFlyout}
              className="fixed left-[92px] ml-1 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 w-64 z-50 text-left transition-all duration-200 animate-fade-in"
            >
              <div className="max-h-[75vh] overflow-y-auto px-2 space-y-1 scrollbar-thin">
                {item.subModules.map((sub) => {
                  const isSubActive = activeMenu === item.name && activeSubMenu === sub;
                  return (
                    <button
                      key={sub}
                      onClick={() => handleSubModuleClick(item.name, sub)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                        isSubActive 
                          ? 'bg-orange-600 text-white shadow-sm' 
                          : 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}

      {/* Collapse Bottom Panel */}
      <div className="p-3 border-t border-slate-50 bg-slate-50/50 shrink-0">
        <button
          id="sidebar-toggle-collapse"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-white hover:text-slate-800 transition-all duration-200 shadow-sm border border-transparent hover:border-slate-100"
        >
          <div className="flex items-center gap-2.5">
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            )}
            {!isCollapsed && <span className="tracking-wide">Collapse</span>}
          </div>
          {!isCollapsed && <span className="text-[9px] text-slate-300 font-mono">⌘B</span>}
        </button>
      </div>
    </aside>
  );
}
