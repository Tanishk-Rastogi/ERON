import React from 'react';
import { LogoIcon } from './LogoIcon';
import { Building2, Bed, ArrowRightLeft, ChevronDown } from 'lucide-react';

export function Header({
  activeTab,
  setActiveTab,
  authSession,
  onLogout,
  onOpenProfile,        // new — opens HospitalProfilePanel
  hasPendingReceiving = true
}) {
  const navItems = [
    { id: 'receiving', label: 'Receiving Tab',  icon: Building2,     hasBadge: hasPendingReceiving },
    { id: 'transfer',  label: 'Transfer',        icon: ArrowRightLeft },
    { id: 'capacity',  label: 'Capacity Panel',  icon: Bed }
  ];

  return (
    <header className="relative z-50 bg-white/90 backdrop-blur-xl border-b border-[#e7e5e4] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Top bar: logo + hospital name + logout ── */}
        <div className="flex items-center justify-between h-16 border-b border-[#f0efed]">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <LogoIcon className="w-9 h-9" />
            <div className="min-w-0">
              <span className="font-extrabold text-xl tracking-tight text-[#0c0a09]">ERON</span>
              <p className="text-[11px] text-[#777169] font-light truncate">
                Emergency Referral Orchestration Network
              </p>
            </div>
          </div>

          {/* Hospital name (clickable → profile) + Logout */}
          {authSession && (
            <div className="flex items-center gap-2">

              {/* Clickable hospital name button */}
              <button
                onClick={onOpenProfile}
                title="View hospital profile & activity log"
                aria-label="Open hospital profile"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e7e5e4] bg-[#fafafa] hover:bg-white hover:border-[#292524] hover:shadow-sm transition-all group max-w-[240px]"
              >
                <Building2 className="w-3.5 h-3.5 text-[#a8a29e] shrink-0 group-hover:text-emerald-600 transition-colors" />
                <span className="text-xs font-bold text-[#0c0a09] truncate">
                  {authSession.hospitalName}
                </span>
                <ChevronDown className="w-3 h-3 text-[#a8a29e] shrink-0 group-hover:text-[#292524] transition-colors" />
              </button>

              <button
                onClick={onLogout}
                aria-label="Log out"
                className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* ── Navigation tabs ── */}
        <nav className="flex space-x-2 overflow-x-auto py-2 scrollbar-none" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-label={`Navigate to ${item.label}`}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                  isActive
                    ? 'bg-[#292524] text-white border-[#292524] shadow-sm font-bold'
                    : 'bg-transparent text-[#777169] border-transparent hover:text-[#0c0a09] hover:bg-[#f0efed]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#777169]'}`} aria-hidden="true" />
                <span>{item.label}</span>
                {item.hasBadge && (
                  <span className="relative flex h-2.5 w-2.5 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white" />
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
