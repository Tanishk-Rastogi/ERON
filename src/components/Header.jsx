import React, { useState } from 'react';
import { LogoIcon } from './LogoIcon';
import { 
  Building2, 
  Bed, 
  LayoutDashboard,
  ArrowRightLeft,
  ShieldAlert,
  Sun,
  Moon
} from 'lucide-react';

export function Header({ activeTab, setActiveTab, authSession, onLogout }) {
  const [isTacticalMode, setIsTacticalMode] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    { id: 'receiving', label: 'Receiving Tab', icon: Building2 },
    { id: 'capacity', label: 'Capacity Panel', icon: Bed }
  ];

  const toggleTacticalMode = () => {
    const nextState = !isTacticalMode;
    setIsTacticalMode(nextState);
    if (nextState) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0c0a09]/90 backdrop-blur-xl border-b border-[#e7e5e4] dark:border-[#292524] shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-[#f0efed] dark:border-[#1c1917]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 min-w-0">
            <LogoIcon className="w-9 h-9" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0c0a09] dark:text-white truncate">
                  ERON
                </span>
                {isTacticalMode && (
                  <span className="text-[9px] font-mono font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    Tactical Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#777169] dark:text-[#a8a29e] font-light truncate">
                Emergency Referral Orchestration Network
              </p>
            </div>
          </div>

          {/* Tactical Theme Toggle & Logged-In Hospital Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTacticalMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border flex items-center gap-1.5 ${
                isTacticalMode 
                  ? 'bg-amber-400 text-black border-amber-400 shadow-md' 
                  : 'bg-[#fafafa] dark:bg-[#1c1917] text-[#292524] dark:text-white border-[#e7e5e4] dark:border-[#292524] hover:bg-[#e7e5e4]'
              }`}
              title="Toggle Tactical Command Center Dark Mode for Trauma Monitors"
            >
              {isTacticalMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-black" />
                  <span>Normal UI</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span>Tactical Dark Mode</span>
                </>
              )}
            </button>

            {authSession && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-xs">
                  <span className="font-bold text-[#0c0a09] dark:text-white truncate max-w-[200px]">
                    {authSession.hospitalName}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  aria-label="Log out"
                  className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
                  title="Log out of hospital facility"
                >
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 overflow-x-auto py-2 scrollbar-none" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-label={`Navigate to ${item.label}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                  isActive
                    ? 'bg-[#292524] dark:bg-white text-white dark:text-[#0c0a09] border-[#292524] dark:border-white shadow-sm font-bold'
                    : 'bg-transparent text-[#777169] dark:text-[#a8a29e] border-transparent hover:text-[#0c0a09] dark:hover:text-white hover:bg-[#f0efed] dark:hover:bg-[#1c1917]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-[#0c0a09]' : 'text-[#777169]'}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
