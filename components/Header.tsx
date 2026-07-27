import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Calendar, 
  LayoutGrid, 
  ChevronDown, 
  User, 
  Shield, 
  Key, 
  Eye, 
  FileText, 
  Settings, 
  RefreshCw, 
  Power, 
  Check, 
  HelpCircle, 
  AlertCircle, 
  Clock,
  Menu,
  X,
  Search,
  MoreVertical,
  ChevronRight,
  Sparkles,
  Sliders,
  Layers,
  Heart,
  ExternalLink
} from 'lucide-react';
import GlobalHRLogo from '@/components/GlobalHRLogo';
import { menuHierarchy, ModuleMenu } from '@/data/menuData';

interface HeaderProps {
  onLogout: () => void;
  username: string;
  activeBrand?: string;
  onBrandChange?: (brand: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activeMenu: string;
  onSelectMenu: (menu: string) => void;
}

export default function Header({ 
  onLogout, 
  username, 
  activeBrand, 
  onBrandChange,
  isSidebarCollapsed,
  onToggleSidebar,
  activeMenu,
  onSelectMenu
}: HeaderProps) {
  // Keeps ticking in 2026 to match screenshot timeline perfectly
  const [currentTime, setCurrentTime] = useState(new Date('2026-07-10T09:43:52'));
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLauncherDropdown, setShowLauncherDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  
  // Custom states for the new redesigned Header features
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    "Dashboard": true,
    "Employee Hub": true
  });
  
  const searchRef = useRef<HTMLDivElement>(null);

  // Captures the precise user login session time
  const [loginTime] = useState(() => {
    return new Date();
  });

  const brands = [
    'Global HR India Ltd',
    'Global HR UK Ltd',
    'Global HR USA Corp',
    'Demo Enterprise Ltd',
    'Nexus Systems Inc'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime((prev) => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle outside clicks for the global search bar dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatLoginDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatLoginTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'am' : 'pm';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes}:${seconds}${ampm}`;
  };

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'AM' : 'PM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = String(hours).padStart(2, '0');
    return `${formattedHours}:${minutes}:${seconds} ${ampm}`;
  };

  const toggleModuleExpand = (moduleName: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  // Advanced modules/sub-modules search
  const getFilteredSearchResults = () => {
    if (!globalSearchQuery.trim()) return [];
    const query = globalSearchQuery.toLowerCase();
    const results: { moduleName: string; subModuleName?: string; path: string }[] = [];

    menuHierarchy.forEach((mod) => {
      // Check if module name matches
      if (mod.name.toLowerCase().includes(query)) {
        results.push({
          moduleName: mod.name,
          path: mod.name
        });
      }
      // Check sub-modules
      mod.subModules.forEach((sub) => {
        if (sub.name.toLowerCase().includes(query)) {
          results.push({
            moduleName: mod.name,
            subModuleName: sub.name,
            path: `${mod.name} ➔ ${sub.name}`
          });
        }
      });
    });

    return results.slice(0, 8); // Limit to top 8
  };

  const handleSearchResultClick = (moduleName: string, subModuleName?: string) => {
    onSelectMenu(moduleName);
    setGlobalSearchQuery('');
    setShowSearchResults(false);
    
    // If it's a specific sub-module under Dashboard tabs, we handle it beautifully
    if (subModuleName) {
      // Small feedback toast/alert could go here
    }
  };

  const searchResults = getFilteredSearchResults();

  const userMenuItems = [
    { name: 'Profile', icon: User, desc: 'Manage your personal details' },
    { name: 'Update Username', icon: Key, desc: 'Change your account username' },
    { name: 'Update Password', icon: Key, desc: 'Secure your login credentials' },
    { name: 'Update Security Questions', icon: Shield, desc: 'Configure safety checkpoints' },
    { name: 'View Last Login Details', icon: Eye, desc: 'IP addresses and logging times' },
    { name: 'View Accounts Details', icon: FileText, desc: 'Access codes & sub-accounts' },
    { name: 'View Company Info', icon: FileText, desc: 'Linked branches & VAT details' },
    { name: 'View My Permissions', icon: Shield, desc: 'Role privileges mapping' }
  ];

  const systemSettingsItems = [
    { name: 'User Settings', icon: Settings },
    { name: 'Brand Settings', icon: RefreshCw },
    { name: 'Module Settings', icon: LayoutGrid },
    { name: 'Masters Config', icon: Settings },
    { name: 'Period Manager', icon: Calendar },
    { name: 'Advance Settings', icon: Shield },
    { name: 'Authority Levels', icon: Shield },
    { name: 'Support Center', icon: HelpCircle }
  ];

  const systemNotifications = [
    { id: 1, title: 'Timesheet Alert', message: '3 Timesheets are currently in Draft status.', time: 'Just now', type: 'warning' },
    { id: 2, title: 'New Employee Registered', message: 'Sandeep Yadav was enrolled successfully.', time: '1 hour ago', type: 'info' },
    { id: 3, title: 'Database Synced', message: 'Global HR system has backed up successfully.', time: '2 hours ago', type: 'success' },
  ];

  return (
    <>
      <header id="enterprise-header" className="h-20 bg-white border-b border-slate-150 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40 select-none shadow-sm shadow-slate-100/40">
        
        {/* Left Area: Welcome Greeting */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col text-left leading-none font-sans">
            <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest hidden sm:block">Enterprise HR Console</span>
            <span className="text-slate-800 text-xs sm:text-sm font-black flex items-center gap-1 mt-0.5 sm:mt-1 leading-none">
              Welcome back, <span className="text-blue-600 font-extrabold">{username}</span> 👋
            </span>
          </div>
        </div>

        {/* Right Area: Logged in session time, Bell alert, Launcher, Active Brand, Profile dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* Session Login Display - desktop/laptop only */}
          <div className="hidden xl:flex items-center gap-2 border border-slate-200/80 rounded-xl px-3 py-1.5 bg-slate-50/50 hover:bg-slate-50 transition-all hover:border-slate-300">
            <div className="flex flex-col text-left leading-none font-sans">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Session</span>
              <span id="session-login-time" className="text-[10px] font-bold text-slate-700 mt-0.5 leading-none font-mono">
                Logged in: <span className="text-blue-600 font-black">{formatLoginTime(loginTime)}</span>
              </span>
            </div>
          </div>

          {/* Notifications Icon */}
          <div className="relative">
            <button
              id="notifications-dropdown-trigger"
              onClick={() => {
                setShowNotificationsDropdown(!showNotificationsDropdown);
                setShowProfileDropdown(false);
                setShowLauncherDropdown(false);
                setShowBrandDropdown(false);
              }}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200/50 transition-all relative"
              title="System Notifications"
            >
              <Bell className="w-4 h-4 stroke-[2]" />
              <span className="absolute -top-1.5 -right-1.5 bg-[#ff5252] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                58
              </span>
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-50 text-left animate-fade-in font-sans">
                <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Alert Center (58 Pending)</span>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md cursor-pointer hover:bg-blue-100">Clear All</span>
                </div>
                <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-50">
                  {systemNotifications.map((noti) => (
                    <div key={noti.id} className="p-3.5 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer">
                      <div className="mt-0.5">
                        <AlertCircle className={`w-4 h-4 ${noti.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{noti.title}</p>
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{noti.message}</p>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block font-mono">{noti.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Launcher / Grid Button */}
          <div className="relative">
            <button
              id="launcher-dropdown-trigger"
              onClick={() => {
                setShowLauncherDropdown(!showLauncherDropdown);
                setShowProfileDropdown(false);
                setShowNotificationsDropdown(false);
                setShowBrandDropdown(false);
              }}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200/50 transition-all"
              title="HR Module Launcher"
            >
              <LayoutGrid className="w-4 h-4 stroke-[2]" />
            </button>

            {/* Launcher Grid Dropdown */}
            {showLauncherDropdown && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50 text-left animate-fade-in font-sans">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-50 pb-2">
                  Enterprise Settings Launcher
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {systemSettingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setShowLauncherDropdown(false);
                          if (onSelectMenu) {
                            onSelectMenu('Settings');
                          }
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/20 text-slate-600 hover:text-blue-600 transition-all text-left text-xs font-bold"
                      >
                        <Icon className="w-4 h-4 text-slate-400 stroke-[2] shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Switch Brand Dropdown */}
          <div className="relative">
            <button
              id="brand-dropdown-trigger"
              onClick={() => {
                setShowBrandDropdown(!showBrandDropdown);
                setShowProfileDropdown(false);
                setShowLauncherDropdown(false);
                setShowNotificationsDropdown(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 text-slate-700 hover:text-blue-600 transition-all hover:border-slate-300 font-sans"
              title="Switch Corporate Brand"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 stroke-[2] ${showBrandDropdown ? 'animate-spin' : ''}`} />
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Brand</span>
                <span id="current-active-brand" className="text-[11px] font-bold text-slate-700 truncate max-w-[120px] mt-0.5">
                  {activeBrand || 'Global HR India Ltd'}
                </span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showBrandDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Switch Brand Dropdown Panel */}
            {showBrandDropdown && (
              <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2.5 z-50 text-left animate-fade-in font-sans">
                <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Select Corporate Brand</span>
                </div>
                <div className="max-h-[220px] overflow-y-auto py-1">
                  {brands.map((brand) => {
                    const isSelected = (activeBrand || 'Global HR India Ltd') === brand;
                    return (
                      <button
                        key={brand}
                        onClick={() => {
                          if (onBrandChange) {
                            onBrandChange(brand);
                          }
                          setShowBrandDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-xs flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-blue-50/30 text-blue-600 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                          <span>{brand}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200/80 mx-0.5 hidden sm:block" />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              id="profile-dropdown-trigger"
              onClick={() => {
                setShowProfileDropdown(!showProfileDropdown);
                setShowLauncherDropdown(false);
                setShowNotificationsDropdown(false);
                setShowBrandDropdown(false);
              }}
              className="flex items-center gap-2 p-1 rounded-full sm:rounded-xl hover:bg-slate-50 transition-all text-slate-700"
            >
              <div className="w-8 h-8 rounded-full bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center font-black text-xs text-[#15803d] shrink-0">
                {username ? username.charAt(0).toUpperCase() : 'D'}
              </div>

              <div className="hidden md:flex flex-col text-left leading-none pr-1">
                <span id="user-display-name" className="text-xs font-bold text-slate-800">
                  {username}
                </span>
                <span id="user-display-role" className="text-[9px] font-medium text-slate-400 mt-0.5">
                  Admin
                </span>
              </div>

              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform hidden md:inline ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Container */}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2.5 z-50 text-left animate-fade-in font-sans">
                <div className="px-4.5 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#dcfce7] flex items-center justify-center font-black text-sm text-[#15803d]">
                    {username ? username.charAt(0).toUpperCase() : 'D'}
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-black text-slate-800">{username}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1">administrator@globalhr.com</span>
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto py-1">
                  <div className="px-3.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Profile Actions</div>
                  {userMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setShowProfileDropdown(false);
                          alert(`Opening Action: ${item.name}`);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 flex flex-col gap-0.5 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <Icon className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                          <span>{item.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 pl-5 leading-tight">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50/50 mt-1">
                  <button
                    id="profile-logout-button"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 transition-colors border border-red-200/30"
                  >
                    <Power className="w-3.5 h-3.5 stroke-[2]" />
                    Logout Session
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>
    </>
  );
}
