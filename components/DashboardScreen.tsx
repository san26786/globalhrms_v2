import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AttendanceDashboard from '@/components/AttendanceDashboard';
import LeaveDashboard from '@/components/LeaveDashboard';
import TimesheetDashboard from '@/components/TimesheetDashboard';
import SubModuleViewer from '@/components/SubModuleViewer';
import DbConnectionDashboard from '@/components/DbConnectionDashboard';
import SystemSettings from '@/components/SystemSettings';
import { ChevronLeft, ChevronRight, Settings, FileText, Briefcase, ShoppingCart, BarChart3, HelpCircle, RefreshCw } from 'lucide-react';

interface DashboardScreenProps {
  username: string;
  onLogout: () => void;
}

type TabType = 'Employee Dashboard' | 'Attendance Dashboard' | 'Leave Dashboard' | 'Timesheet Dashboard';

export default function DashboardScreen({ username, onLogout }: DashboardScreenProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [activeTab, setActiveTab] = useState<TabType>('Employee Dashboard');
  const [activeSubMenu, setActiveSubMenu] = useState<string | undefined>('Employee Dashboard');
  const [activeBrand, setActiveBrand] = useState('Global HR India Ltd');
  const [brandSwitchNotification, setBrandSwitchNotification] = useState<string | null>(null);

  useEffect(() => {
    if (activeMenu === 'Dashboard') {
      setActiveSubMenu(activeTab);
    }
  }, [activeTab, activeMenu]);

  const handleBrandChange = (newBrand: string) => {
    setActiveBrand(newBrand);
    setBrandSwitchNotification(`Successfully loaded workspace environment for ${newBrand}.`);
    setTimeout(() => {
      setBrandSwitchNotification(null);
    }, 4000);
  };

  const tabs: TabType[] = [
    'Employee Dashboard',
    'Attendance Dashboard',
    'Leave Dashboard',
    'Timesheet Dashboard'
  ];

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleNextTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTab(tabs[nextIndex]);
  };

  const handlePrevTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[prevIndex]);
  };

  // Smart selection linking Sidebar and Dashboard Tabs
  const handleSelectMenu = (menu: string, subMenu?: string) => {
    setActiveMenu(menu);
    setActiveSubMenu(subMenu);

    if (menu === 'Dashboard') {
      if (subMenu === 'Employee Dashboard' || !subMenu) {
        setActiveTab('Employee Dashboard');
      } else if (subMenu === 'Attendance Dashboard') {
        setActiveTab('Attendance Dashboard');
      } else if (subMenu === 'Leave Dashboard') {
        setActiveTab('Leave Dashboard');
      } else if (subMenu === 'Timesheet Dashboard') {
        setActiveTab('Timesheet Dashboard');
      }
    }
  };

  // Render content based on active menu and active tab
  const renderContent = () => {
    if (activeMenu !== 'Dashboard') {
      if (activeMenu === 'Settings') {
        return <DbConnectionDashboard />;
      }
      if (activeMenu === 'System Settings') {
        return <SystemSettings activeSubMenu={activeSubMenu} activeBrand={activeBrand} />;
      }
      if (activeSubMenu) {
        return (
          <SubModuleViewer
            moduleName={activeMenu}
            subModuleName={activeSubMenu}
            activeBrand={activeBrand}
          />
        );
      }

      // Custom elegant module screen for generic sidebar links
      const getModuleIcon = () => {
        switch (activeMenu) {
          case 'Sales Order': return <FileText className="w-10 h-10 text-emerald-600" />;
          case 'Bank Manager': return <Briefcase className="w-10 h-10 text-blue-600" />;
          case 'Purchase Order': return <ShoppingCart className="w-10 h-10 text-orange-600" />;
          case 'Reports': return <BarChart3 className="w-10 h-10 text-indigo-600" />;
          case 'Settings': return <Settings className="w-10 h-10 text-slate-600" />;
          default: return <HelpCircle className="w-10 h-10 text-blue-600" />;
        }
      };

      return (
        <div className="bg-white rounded-3xl border border-slate-100 p-8 sm:p-12 text-center shadow-lg max-w-2xl mx-auto my-12 animate-fade-in">
          <div className="w-18 h-18 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            {getModuleIcon()}
          </div>
          <h3 className="font-display font-black text-slate-800 text-lg sm:text-xl">
            {activeMenu} Module
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-3 max-w-md mx-auto leading-relaxed font-semibold">
            This module is fully configured and linked to the live enterprise cloud node. Live transaction pipelines, sync events, and records logs are operational.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              onClick={() => setActiveMenu('Dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all active:scale-95"
            >
              Return to Core Dashboard
            </button>
          </div>
        </div>
      );
    }

    // Render corresponding interactive tab
    switch (activeTab) {
      case 'Employee Dashboard':
        return <EmployeeDashboard />;
      case 'Attendance Dashboard':
        return <AttendanceDashboard />;
      case 'Leave Dashboard':
        return <LeaveDashboard />;
      case 'Timesheet Dashboard':
        return <TimesheetDashboard />;
      default:
        return <EmployeeDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-600 relative">
      {/* Collapsible sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeBrand={activeBrand}
        activeMenu={activeMenu}
        activeSubMenu={activeSubMenu}
        onSelectMenu={handleSelectMenu}
      />

      {/* Main container shifted based on Sidebar size */}
      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-24' : 'pl-64'
        }`}
      >
        {/* White-bar enterprise header exactly like the screenshot */}
        <Header 
          username={username} 
          onLogout={onLogout} 
          activeBrand={activeBrand} 
          onBrandChange={handleBrandChange}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          activeMenu={activeMenu}
          onSelectMenu={handleSelectMenu}
        />

        {/* Dynamic Navigation Tabs list on Dashboard Workspace */}
        {activeMenu === 'Dashboard' && (
          <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-2.5 sticky top-20 z-30 flex items-center justify-between select-none shadow-sm shadow-slate-100/20">
            {/* Arrow Left */}
            <button
              onClick={handlePrevTab}
              className="p-1.5 hover:bg-slate-50 rounded-xl border border-slate-200/50 text-slate-400 hover:text-slate-800 transition-colors"
              title="Previous Tab"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable list of tabs */}
            <div className="flex-1 flex justify-center overflow-x-auto scrollbar-none mx-4 gap-2 sm:gap-4 md:gap-5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4.5 py-2 text-[11px] sm:text-xs font-black whitespace-nowrap transition-all border-b-2 relative flex items-center gap-2 ${
                      isActive
                        ? 'text-blue-600 border-blue-500 font-black'
                        : 'text-slate-400 border-transparent hover:text-slate-600'
                    }`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Arrow Right */}
            <button
              onClick={handleNextTab}
              className="p-1.5 hover:bg-slate-50 rounded-xl border border-slate-200/50 text-slate-400 hover:text-slate-800 transition-colors"
              title="Next Tab"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dashboard main workspace */}
        <main className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>

      {/* Toast Notification for brand switching */}
      {brandSwitchNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 animate-fade-in border border-slate-800 font-sans max-w-sm">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black tracking-wider uppercase text-blue-400 leading-none">Enterprise Context</p>
            <p className="text-[11px] text-slate-300 font-bold mt-1 leading-tight">{brandSwitchNotification}</p>
          </div>
        </div>
      )}
    </div>
  );
}
