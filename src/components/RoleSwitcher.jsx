import React from 'react';
import { UserCheck, Shield, Stethoscope, Building2, Ambulance, Eye } from 'lucide-react';

export function RoleSwitcher({ activeRole, onRoleChange }) {
  const roles = [
    {
      id: 'nurse-a',
      name: 'Nurse Anjali Verma',
      roleDesk: 'Duty Nurse',
      hospitalId: 'hosp-a',
      hospitalName: 'District Hospital Central (Hosp A)',
      icon: Stethoscope,
      color: 'bg-blue-50 text-blue-800 border-blue-200'
    },
    {
      id: 'bed-b',
      name: 'Bed Desk B - Rajesh',
      roleDesk: 'Receiving Bed Desk',
      hospitalId: 'hosp-b',
      hospitalName: 'City Super Specialty (Hosp B)',
      icon: Building2,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    },
    {
      id: 'driver-101',
      name: 'Suresh Kumar (Driver)',
      roleDesk: 'Ambulance Driver',
      hospitalId: 'hosp-a',
      hospitalName: 'ALS Unit AMB-101',
      icon: Ambulance,
      color: 'bg-amber-50 text-amber-900 border-amber-200'
    },
    {
      id: 'control-admin',
      name: 'District Control Room Admin',
      roleDesk: 'District Controller',
      hospitalId: 'hosp-control',
      hospitalName: 'District-01 Command HQ',
      icon: Shield,
      color: 'bg-[#292524] text-white border-[#292524]'
    }
  ];

  return (
    <div className="eleven-card p-4 bg-white border-[#e7e5e4] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#292524]" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#0c0a09]">
            Active Tester Perspective / Role Switcher
          </h3>
        </div>
        <span className="text-[10px] bg-[#f0efed] font-mono px-2 py-0.5 rounded-full text-[#777169]">
          Backend Headers Synced
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {roles.map(r => {
          const Icon = r.icon;
          const isSelected = activeRole?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => onRoleChange(r)}
              className={`p-3 rounded-2xl border text-left text-xs font-mono transition-all flex flex-col justify-between space-y-2 ${
                isSelected 
                  ? 'bg-[#292524] text-white border-[#292524] shadow-sm' 
                  : 'bg-[#fafafa] text-[#292524] border-[#e7e5e4] hover:bg-[#f0efed]'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#777169]'}`} />
                {isSelected && (
                  <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-bold">
                    ACTIVE
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold truncate">{r.roleDesk}</div>
                <div className={`text-[10px] truncate ${isSelected ? 'text-[#a8a29e]' : 'text-[#777169]'}`}>
                  {r.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
