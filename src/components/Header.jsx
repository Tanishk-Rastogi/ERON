import React from 'react';
import { LogoIcon } from './LogoIcon';
import { 
  Building2, 
  Bed, 
  ArrowRightLeft
} from 'lucide-react';

export function Header({ activeTab, setActiveTab, authSession, onLogout }) {
  const navItems = [
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    { id: 'receiving', label: 'Receiving Tab', icon: Building2 },
    { id: 'capacity', label: 'Capacity Panel', icon: Bed }
  ];

  return (
    <header className="relative z-50 bg-white/90 backdrop-blur-xl border-b border-[#e7e5e4] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-[#f0efed]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 min-w-0">
            <LogoIcon className="w-9 h-9" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#0c0a09] truncate">
                  ERON
                </span>
              </div>
              <p className="text-[11px] text-[#777169] font-light truncate">
                Emergency Referral Orchestration Network
              </p>
            </div>
          </div>

          {/* Logged-In Hospital Badge & Logout Button */}
          {authSession && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-bold text-[#0c0a09] truncate max-w-[200px]">
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

        {/* Scrollable Navigation Tabs */}
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
                    ? 'bg-[#292524] text-white border-[#292524] shadow-sm font-bold'
                    : 'bg-transparent text-[#777169] border-transparent hover:text-[#0c0a09] hover:bg-[#f0efed]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#777169]'}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
