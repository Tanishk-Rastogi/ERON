import React from 'react';
import { LogoIcon } from './LogoIcon';
import { 
  Building2, 
  Compass, 
  Bed, 
  LayoutDashboard
} from 'lucide-react';

export function Header({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard },
    { id: 'critical-find', label: 'Critical Find', icon: Compass, badge: 'FAST MATCH' },
    { id: 'receiving', label: 'Receiving Tab', icon: Building2 },
    { id: 'capacity', label: 'Capacity Panel', icon: Bed }
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#e7e5e4] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-[#f0efed]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <LogoIcon className="w-9 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0c0a09]">
                  ERON
                </span>
              </div>
              <p className="text-[11px] text-[#777169] font-light">Emergency Referral Orchestration Network</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#292524] text-white border-[#292524] shadow-sm'
                    : 'bg-transparent text-[#777169] border-transparent hover:text-[#0c0a09] hover:bg-[#f0efed]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#777169]'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] uppercase font-bold bg-[#c8b8e0]/40 text-[#0c0a09] px-1.5 py-0.2 rounded-full border border-[#c8b8e0]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
