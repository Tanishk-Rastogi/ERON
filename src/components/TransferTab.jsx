import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

export function TransferTab() {
  return (
    <div className="space-y-6 font-sans">
      <div className="eleven-card p-12 text-center space-y-3 bg-white border-[#e7e5e4] shadow-2xs">
        <ArrowRightLeft className="w-12 h-12 text-[#a8a29e] mx-auto" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[#292524]">No Active Transfers</h3>
        <p className="text-xs text-[#777169] max-w-sm mx-auto">
          Transfer queue is currently empty. Initiated patient transfers and routing updates will appear here.
        </p>
      </div>
    </div>
  );
}
